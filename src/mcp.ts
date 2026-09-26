import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { signHeaders } from "./aws.js";
import { env } from "./env.js";
import { RIOT_PRODUCTS, clockDesired, favoriteDesired, favoriteMismatches, findSound, lightDesired, lightOffDesired, parseColor, patchFavorite, soundDesired, summarize, summarizeFavorite, toddlerLockDesired, turnOffDesired, volumeDesired, type Device, type Favorite } from "./hatch.js";
import { getShadows } from "./mqtt.js";
import { presignMqttUrl } from "./aws.js";

const output = (value: unknown, isError = false) => ({ isError, content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const run = async (op: () => Promise<unknown>) => { try { return output(await op()); } catch (error) { return { isError: true, content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }] }; } };
const owner = () => env().HATCH_SESSION.getByName("owner");
const supported = (device: Device) => RIOT_PRODUCTS.has(device.product) || device.product === "restPlus";
const riot = (device: Device) => RIOT_PRODUCTS.has(device.product);
const favoriteNamed = (favorites: Favorite[], value: string | number) => {
  const numeric = typeof value === "number" || /^\d+$/.test(value) ? Number(value) : undefined;
  const matches = favorites.filter((item) => item.id === numeric || item.name.toLowerCase() === String(value).toLowerCase());
  if (!matches.length) throw new Error(`Unknown favorite "${value}".`);
  if (matches.length > 1) throw new Error(`Favorite name is ambiguous; use one of these ids: ${matches.map((item) => item.id).join(", ")}`);
  return matches[0];
};

async function deviceNamed(value: string, write = false): Promise<Device> {
  const devices = await owner().devices(), needle = value.toLowerCase();
  const device = devices.find((item) => [item.name, item.thingName, item.macAddress].some((field) => field.toLowerCase() === needle));
  if (!device) throw new Error(`Unknown device "${value}". Known: ${devices.map((item) => item.name).join(", ")}`);
  if (write && !supported(device)) throw new Error(`${device.name} is not supported (product ${device.product})`);
  return device;
}

async function shadows(devices: Device[]): Promise<Record<string, any>> {
  if (!devices.length) return {};
  const aws = await owner().aws(), host = aws.endpoint.replace(/^https:\/\//, ""), url = await presignMqttUrl(host, aws.region, aws.creds);
  const email = env().HATCH_EMAIL.replace(/[^a-z]/gi, "") || "owner";
  return await getShadows(url, `hatch_rest_api/${email}/${crypto.randomUUID()}`, devices.map((device) => device.thingName)) as Record<string, any>;
}

async function reported(device: Device): Promise<Record<string, any>> {
  const doc = (await shadows([device]))[device.thingName];
  if (!doc?.state?.reported) throw new Error(`No shadow reported for ${device.name}`);
  return doc.state.reported;
}

// The Hatch app waits 15 s for the shadow to report the new dataVersion before confirming.
async function deviceReports(device: Device, dataVersion: string) {
  for (const deadline = Date.now() + 20_000; Date.now() < deadline; await new Promise((resolve) => setTimeout(resolve, 2_000))) {
    if ((await reported(device)).dataVersion === dataVersion) return true;
  }
  return false;
}

async function publish(device: Device, desired: unknown, state: Record<string, any>) {
  const aws = await owner().aws(), host = aws.endpoint.replace(/^https:\/\//, "");
  const topic = `$aws/things/${device.thingName}/shadow/update`, url = `https://${host}/topics/${encodeURIComponent(topic)}?qos=1`;
  const body = JSON.stringify({ state: { desired } }), signed = await signHeaders("POST", url, aws.region, "iotdata", aws.creds, body);
  const { host: _host, ...headers } = signed;
  const response = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(15_000) });
  const result = await response.json().catch(() => null) as { message?: unknown } | null;
  if (response.status === 403 && result?.message === null) throw new Error("Hatch AWS permissions denied this action");
  if (!response.ok) throw new Error(`Hatch AWS publish failed: HTTP ${response.status}`);
  return { ok: true, device: device.name, desired, ...(state.connected === false ? { warning: "device reported offline" } : {}) };
}

async function write(deviceName: string, build: (device: Device, state: Record<string, any>) => Promise<unknown> | unknown) {
  const device = await deviceNamed(deviceName, true), state = await reported(device);
  return publish(device, await build(device, state), state);
}

const deviceArg = z.string().min(1).describe("Device name, thingName, or MAC address (case-insensitive)");
const changed = " Publishes desired state without reading it back; call list_devices to confirm.";

export async function createMcpServer(): Promise<McpServer> {
  const server = new McpServer({ name: "hatch-mcp", version: "1.0.0" }, {
    instructions: "One family's Hatch Rest sound machines (kids' bedrooms). Writes change a real device immediately — confirm with the user before playing sounds or changing lights at night. Use list_devices first.",
  });

  server.tool("list_devices", "List every Hatch Wi-Fi device with a live summary; unsupported models are identified.", {}, () => run(async () => {
    const devices = await owner().devices(), [docs, content] = await Promise.all([shadows(devices), owner().content()]);
    return Promise.all(devices.map(async (device) => summarize(device, docs[device.thingName]?.state?.reported, riot(device) ? await owner().favorites(device.macAddress).catch(() => []) : [], content)));
  }));

  server.tool("get_device", "Get raw state.reported for one supported device.", { device: deviceArg }, ({ device }) => run(async () => reported(await deviceNamed(device))));

  server.tool("list_favorites", "List favorites/routines for a riot-family device.", { device: deviceArg }, ({ device }) => run(async () => {
    const found = await deviceNamed(device); if (!riot(found)) throw new Error(`${found.name} does not support favorites (product ${found.product})`);
    const [favorites, content] = await Promise.all([owner().favorites(found.macAddress), owner().content()]);
    return favorites.map((favorite: Favorite) => summarizeFavorite(favorite, content));
  }));

  server.tool("play_favorite", "Play a favorite on a riot-family device." + changed, { device: deviceArg, favorite: z.union([z.string().min(1), z.number().int()]) }, ({ device, favorite }) => run(() => write(device, async (found) => {
    if (!riot(found)) throw new Error(`${found.name} does not support favorites (product ${found.product})`);
    return favoriteDesired(favoriteNamed(await owner().favorites(found.macAddress), favorite).id);
  })));

  server.tool("update_favorite", "Edit an existing favorite's schedule/content in the Hatch cloud. Waits for the device to sync, reads the favorite back from Hatch, and errors listing any field that did not persist. Hatch gives the favorite a NEW id on every edit; the result's id is current and previous_id is the old one. Sound, color (catalog name, #rrggbb, or off), volume, brightness, and duration apply to every step. button binds the favorite to the device's touch button (button 0) or unbinds it; Rest+ 2nd gen has only that one button, so button 1/2 are not supported, and several favorites may share it. The device must be online. Create new favorites in the Hatch app.", {
    device: deviceArg, favorite: z.union([z.string().min(1), z.number().int()]), name: z.string().min(1).optional(), enabled: z.boolean().optional(),
    start_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
    days: z.union([z.array(z.enum(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])), z.enum(["every day", "weekdays", "weekends", "none"])]).optional(),
    sound: z.union([z.string().min(1), z.number().int()]).optional(), volume: z.number().min(0).max(100).optional(),
    color: z.string().min(1).describe("Catalog color name, #rrggbb, or off").optional(), brightness: z.number().min(1).max(100).optional(), duration_minutes: z.number().min(0).optional(),
    button: z.boolean().describe("true binds to the touch button (button 0); false unbinds").optional(),
  }, ({ device, favorite, ...patch }) => run(async () => {
    if (Object.values(patch).every((value) => value === undefined)) throw new Error("At least one patch field is required.");
    const found = await deviceNamed(device, true); if (!riot(found)) throw new Error(`${found.name} does not support favorites (product ${found.product})`);
    const [favorites, content] = await Promise.all([owner().favorites(found.macAddress, true), owner().content()]);
    const current = favoriteNamed(favorites, favorite), expected = patchFavorite(current, patch, content);
    const saved = await owner().createOrEditRoutine(found.macAddress, expected);
    if (saved.confirmDataVersion) {
      if (!saved.dataVersion) throw new Error("Hatch asked to confirm the edit without a data version.");
      if (!await deviceReports(found, saved.dataVersion)) throw new Error(`${found.name} did not sync the edit within 20 s (offline?). Hatch left it unconfirmed, so favorite ${current.id} is unchanged.`);
      await owner().confirmDataVersion(found.macAddress, saved.dataVersion);
    }
    const id = saved.item?.id ?? current.id, actual = (await owner().favorites(found.macAddress, true)).find((item) => item.id === id && item.active);
    if (!actual) throw new Error(`Favorite ${id} is missing after the edit; call list_favorites.`);
    const summary = summarizeFavorite(actual, content), mismatches = favoriteMismatches(summarizeFavorite(expected, content), summary);
    if (mismatches.length) throw new Error(`Hatch accepted the edit but these fields did not persist: ${mismatches.join("; ")}. Current favorite: ${JSON.stringify(summary)}`);
    return { ...summary, ...(id === current.id ? {} : { previous_id: current.id }) };
  }));

  server.tool("play_sound", "Play a catalog sound." + changed, { device: deviceArg, sound: z.union([z.string().min(1), z.number().int()]), volume: z.number().min(0).max(100).optional() }, ({ device, sound, volume }) => run(() => write(device, async (found) => soundDesired(found.product, findSound(found.product, String(sound), riot(found) ? await owner().content() : []), volume))));

  server.tool("set_volume", "Set sound volume from 0 to 100." + changed, { device: deviceArg, volume: z.number().min(0).max(100) }, ({ device, volume }) => run(() => write(device, (found) => volumeDesired(found.product, volume))));

  server.tool("set_light", "Set the nightlight to a catalog color or #rrggbb and brightness from 1 to 100." + changed, { device: deviceArg, color: z.string().min(1), brightness: z.number().min(1).max(100) }, ({ device, color, brightness }) => run(() => write(device, async (found, state) => lightDesired(found.product, parseColor(color, riot(found) ? await owner().content() : []), brightness, state.current?.playing))));

  server.tool("light_off", "Turn the light off while preserving a playing routine when supported." + changed, { device: deviceArg }, ({ device }) => run(() => write(device, (found, state) => lightOffDesired(found.product, state.current?.playing))));

  server.tool("turn_off", "Turn off sound and light." + changed, { device: deviceArg }, ({ device }) => run(() => write(device, (found) => turnOffDesired(found.product))));

  server.tool("set_clock", "Turn the clock on or off on a riot-family device." + changed, { device: deviceArg, on: z.boolean(), brightness: z.number().min(0).max(100).optional() }, ({ device, on, brightness }) => run(() => write(device, (found, state) => {
    if (!riot(found)) throw new Error(`${found.name} does not support clock control (product ${found.product})`);
    return clockDesired(on, brightness, state.clock?.flags ?? 0);
  })));

  server.tool("set_toddler_lock", "Turn toddler lock on or off on a riot-family device." + changed, { device: deviceArg, on: z.boolean() }, ({ device, on }) => run(() => write(device, (found) => {
    if (!riot(found)) throw new Error(`${found.name} does not support toddler lock (product ${found.product})`);
    return toddlerLockDesired(on);
  })));

  return server;
}
