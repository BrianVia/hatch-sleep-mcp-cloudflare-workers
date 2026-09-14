const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (data: string | BufferSource) => hex(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data));
const hmac = async (key: string | BufferSource, data: string) => {
  const imported = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", imported, enc.encode(data));
};

export type AwsCredentials = { accessKeyId: string; secretKey: string; sessionToken: string; expiration?: number };
const timestamp = () => { const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, ""); return { amzDate, date: amzDate.slice(0, 8) }; };
const signingKey = async (secret: string, date: string, region: string, service: string) => {
  let key: ArrayBuffer = await hmac(`AWS4${secret}`, date);
  for (const part of [region, service, "aws4_request"]) key = await hmac(key, part);
  return key;
};

export async function signHeaders(method: string, url: string, region: string, service: string, creds: AwsCredentials, body: string): Promise<Record<string, string>> {
  const target = new URL(url), { amzDate, date } = timestamp(), bodyHash = await sha256(body);
  const headers = { host: target.host, "x-amz-content-sha256": bodyHash, "x-amz-date": amzDate, "x-amz-security-token": creds.sessionToken };
  const signed = Object.keys(headers).sort();
  const query = [...target.searchParams].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonicalHeaders = signed.map((name) => `${name}:${headers[name as keyof typeof headers].trim()}\n`).join("");
  // SigV4 canonical URI: each path segment percent-encoded once more (non-S3 services double-encode), so "%24aws" → "%2524aws"
  const canonicalPath = target.pathname.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  const canonical = [method, canonicalPath, query, canonicalHeaders, signed.join(";"), bodyHash].join("\n");
  const scope = `${date}/${region}/${service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonical)].join("\n");
  const signature = hex(await hmac(await signingKey(creds.secretKey, date, region, service), toSign));
  return { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${signature}` };
}

/** SigV4 presigned URL for MQTT over WebSocket. The session token is appended after signing. */
export async function presignMqttUrl(host: string, region: string, creds: AwsCredentials): Promise<string> {
  const { amzDate, date } = timestamp(), scope = `${date}/${region}/iotdevicegateway/aws4_request`;
  const query = `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(`${creds.accessKeyId}/${scope}`)}&X-Amz-Date=${amzDate}&X-Amz-SignedHeaders=host`;
  const canonical = ["GET", "/mqtt", query, `host:${host}\n`, "host", await sha256("")].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonical)].join("\n");
  const signature = hex(await hmac(await signingKey(creds.secretKey, date, region, "iotdevicegateway"), toSign));
  return `wss://${host}/mqtt?${query}&X-Amz-Signature=${signature}&X-Amz-Security-Token=${encodeURIComponent(creds.sessionToken)}`;
}
