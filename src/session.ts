import { DurableObject } from "cloudflare:workers";
import { COLORS, SOUNDS, type ContentItem, type Device, type Favorite } from "./hatch.js";
import type { AwsCredentials } from "./aws.js";
import type { Env } from "./env.js";

const BASE = "https://data.hatchbaby.com/";
const PRODUCTS = ["restMini", "restPlus", "riot", "riotPlus", "restBaby", "restoreIot", "restoreV4", "restoreV5"];
type Cached<T> = { value: T; expiresAt: number };
type AwsSession = { endpoint: string; region: string; creds: AwsCredentials & { expiration: number } };
type HatchResponse<T> = { status?: string; payload?: T; token?: string; errorCode?: number; message?: string };

export class HatchSession extends DurableObject<Env> {
  private awsInflight?: Promise<AwsSession>;

  async status(): Promise<{ loggedIn: boolean; awsExpiresAt: string | null }> {
    const [token, aws] = await Promise.all([this.ctx.storage.get<string>("token"), this.ctx.storage.get<AwsSession>("aws")]);
    return { loggedIn: !!token, awsExpiresAt: aws ? new Date(aws.creds.expiration * 1000).toISOString() : null };
  }

  async devices(): Promise<Device[]> {
    const cached = await this.ctx.storage.get<Cached<Device[]>>("devices");
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const query = PRODUCTS.map((product) => `iotProducts=${encodeURIComponent(product)}`).join("&");
    const value = await this.request<Device[]>(`service/app/iotDevice/v2/fetch?${query}`);
    await this.ctx.storage.put("devices", { value, expiresAt: Date.now() + 10 * 60_000 });
    return value;
  }

  async favorites(mac: string, fresh = false): Promise<Favorite[]> {
    const key = `favorites:${mac}`, cached = await this.ctx.storage.get<Cached<Favorite[]>>(key);
    if (!fresh && cached && cached.expiresAt > Date.now()) return cached.value;
    const value = (await this.request<Favorite[]>(`service/app/routine/v2/fetch?macAddress=${encodeURIComponent(mac)}`)).sort((a, b) => (a.displayOrder ?? Infinity) - (b.displayOrder ?? Infinity));
    await this.ctx.storage.put(key, { value, expiresAt: Date.now() + 10 * 60_000 });
    return value;
  }

  // Same call the Hatch app makes. Hatch saves an inactive copy under a new id; it replaces the
  // original only after the device reports dataVersion and we confirm it (confirmDataVersion).
  // editMultiple is not an alternative: it only carries routine-level fields and silently drops steps.
  async createOrEditRoutine(mac: string, routine: Favorite): Promise<{ confirmDataVersion?: boolean; dataVersion?: string; item?: Favorite }> {
    await this.ctx.storage.delete(`favorites:${mac}`);
    return this.request("service/app/routine/v2/createOrEdit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(routine) });
  }

  async confirmDataVersion(mac: string, dataVersion: string): Promise<void> {
    await this.ctx.storage.delete(`favorites:${mac}`);
    await this.request("service/app/v2/dataVersion", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataVersion, macAddress: mac, success: true, returnAllRoutines: true }),
    });
  }

  async content(): Promise<ContentItem[]> {
    const cached = await this.ctx.storage.get<Cached<ContentItem[]>>("content");
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    let value: ContentItem[];
    try {
      const payload = await this.request<{ contentItems?: ContentItem[] }>("service/app/content/v1/fetchByProduct?product=riot&contentTypes=sound&contentTypes=color");
      value = payload.contentItems ?? [];
    } catch {
      value = [
        ...COLORS.map((x) => ({ id: x.id, title: x.name, contentType: "color", red: x.r, green: x.g, blue: x.b, white: x.w })),
        ...SOUNDS.map((x) => ({ id: x.id, title: x.name, contentType: "sound", wavUrl: x.url })),
      ];
    }
    await this.ctx.storage.put("content", { value, expiresAt: Date.now() + 24 * 60 * 60_000 });
    return value;
  }

  async aws(): Promise<AwsSession> {
    const cached = await this.ctx.storage.get<AwsSession>("aws");
    if (cached && cached.creds.expiration * 1000 - Date.now() > 5 * 60_000) return cached;
    if (!this.awsInflight) this.awsInflight = this.refreshAws().finally(() => { this.awsInflight = undefined; });
    return this.awsInflight;
  }

  private async refreshAws(): Promise<AwsSession> {
    const token = await this.request<{ endpoint: string; identityId: string; region: string; cognitoPoolId: string; token: string }>("service/app/restPlus/token/v1/fetch");
    const response = await fetch(`https://cognito-identity.${token.region}.amazonaws.com`, {
      method: "POST",
      headers: { "content-type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityService.GetCredentialsForIdentity" },
      body: JSON.stringify({ IdentityId: token.identityId, Logins: { "cognito-identity.amazonaws.com": token.token } }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => null) as { Credentials?: { AccessKeyId?: string; SecretKey?: string; SessionToken?: string; Expiration?: number } } | null;
    const credentials = body?.Credentials;
    if (!response.ok || !credentials?.AccessKeyId || !credentials.SecretKey || !credentials.SessionToken || !credentials.Expiration) throw new Error(`Hatch Cognito credentials failed: HTTP ${response.status}`);
    const value: AwsSession = { endpoint: token.endpoint, region: token.region, creds: { accessKeyId: credentials.AccessKeyId, secretKey: credentials.SecretKey, sessionToken: credentials.SessionToken, expiration: credentials.Expiration } };
    await this.ctx.storage.put("aws", value);
    return value;
  }

  private async login(): Promise<string> {
    const response = await fetch(`${BASE}public/v1/login`, {
      method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "hatch_rest_api" },
      body: JSON.stringify({ email: this.env.HATCH_EMAIL, password: this.env.HATCH_PASSWORD }), signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 429) throw new Error("Hatch rate limit");
    const body = await response.json().catch(() => null) as HatchResponse<{ token?: string }> | null;
    const token = body?.token ?? body?.payload?.token;
    if (!response.ok || typeof token !== "string") throw new Error(`Hatch login failed${body?.message ? `: ${body.message}` : `: HTTP ${response.status}`}`);
    await this.ctx.storage.put("token", token);
    return token;
  }

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const token = await this.ctx.storage.get<string>("token") ?? await this.login();
    const headers = new Headers(init.headers); headers.set("User-Agent", "hatch_rest_api"); headers.set("X-HatchBaby-Auth", token);
    const response = await fetch(`${BASE}${path}`, { ...init, headers, signal: AbortSignal.timeout(30_000) });
    if (response.status === 429) throw new Error("Hatch rate limit");
    const body = await response.json().catch(() => null) as HatchResponse<T> | null;
    if (body?.errorCode === 1001 && retry) { await this.ctx.storage.delete("token"); return this.request<T>(path, init, false); }
    if (!response.ok || body?.status !== "success" || body.payload === undefined) throw new Error(`Hatch API failed${body?.message ? `: ${body.message}` : `: HTTP ${response.status}`}`);
    return body.payload;
  }
}
