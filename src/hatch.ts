export const MAX_IOT_VALUE = 65_535;
export const NO_COLOR_ID = 9998, CUSTOM_COLOR_ID = 9999, NO_SOUND_ID = 19998;
export const RIOT_FLAGS_CLOCK_ON = 1 << 15, RIOT_FLAGS_CLOCK_24_HOUR = 1 << 11;
export const RIOT_PRODUCTS = new Set(["riot", "riotPlus", "restBaby"]);

export type Device = {
  name: string; product: string; thingName: string; macAddress: string;
  productDevice?: { firmwareVersion?: string; marketingName?: string };
};
export type FavoriteStep = {
  id?: number; name?: string; type?: string; dayOffset?: number; enabled?: boolean;
  sound?: { id?: number; v?: number; duration?: number | null; until?: string; contentfulId?: string; ignore?: boolean };
  color?: { id?: number; r?: number; g?: number; b?: number; w?: number; i?: number; duration?: number | null; until?: string; contentfulId?: string; ignore?: boolean };
};
export type Favorite = {
  id: number; name: string; type: string; active: boolean; enabled?: boolean; displayOrder?: number;
  startTime?: string | null; daysOfWeek?: number; button0?: boolean; button1?: boolean; button2?: boolean; steps?: FavoriteStep[];
  endTime?: string | null; macAddress?: string;
};
export type FavoritePatch = { name?: string; enabled?: boolean; start_time?: string; days?: string[] | "every day" | "weekdays" | "weekends" | "none"; sound?: string | number; volume?: number; color?: string; brightness?: number; duration_minutes?: number };
export type ContentItem = { id: number; title: string; contentType: string; red?: number; green?: number; blue?: number; white?: number; wavUrl?: string; mp3Url?: string };
export type Color = { id: number; name: string; r: number; g: number; b: number; w: number };
export type Sound = { id: number; name: string; url: string };

export const COLORS: Color[] = [
  { id: 9998, name: "No Color", r: 0, g: 0, b: 0, w: 0 },
  { id: 233, name: "White", r: 0, g: 0, b: 0, w: 65535 },
  { id: 234, name: "Red", r: 65535, g: 0, b: 0, w: 0 },
  { id: 235, name: "Orange", r: 61166, g: 43690, b: 0, w: 21845 },
  { id: 236, name: "Yellow", r: 65535, g: 63479, b: 20560, w: 21845 },
  { id: 237, name: "Green", r: 0, g: 65535, b: 0, w: 21845 },
  { id: 238, name: "Sky", r: 34952, g: 52394, b: 65450, w: 21845 },
  { id: 239, name: "Blue", r: 0, g: 0, b: 65535, w: 0 },
  { id: 240, name: "Purple", r: 51400, g: 6168, b: 65535, w: 0 },
  { id: 241, name: "Pink", r: 56831, g: 13294, b: 35003, w: 4369 },
  { id: 9997, name: "Rainbow", r: 0, g: 0, b: 0, w: 0 },
  { id: 9999, name: "Custom", r: 0, g: 0, b: 0, w: 0 },
];

const hatchSound = (id: number, name: string, file: string): Sound => ({ id, name, url: `https://images.hatchbaby.com/content/sounds/${file}.wav` });
export const SOUNDS: Sound[] = [
  hatchSound(10137, "White Noise", "003_pinknoise16"), hatchSound(10138, "Ocean", "Crashing_Ocean_Waves_20210412"),
  hatchSound(10139, "Rain", "Steady_Rain_20210412"), hatchSound(10140, "Birds", "Morning_Birds_20210412"),
  hatchSound(10141, "Wind", "006_wind16"), hatchSound(10142, "Water", "002_waterstreamsmallclose16"),
  hatchSound(10143, "Dryer", "004_dryerclothes16"), hatchSound(10144, "Heartbeat", "001_heartbeat"),
  hatchSound(10145, "Fan", "FanNoise_20191122"), hatchSound(10146, "Thunderstorm", "Thunderstorm_20210412"),
  { id: 10200, name: "Brown Noise", url: "https://assets.ctfassets.net/hlsdh3zwyrtx/Bqk8q7mjFcSa8B1Ovgllp/e9701ae7df057a31b89a4cd2830ef0dc/Brown_Noise_2_20210412.wav" },
  { id: 10082, name: "Forest Lake", url: "https://downloads.ctfassets.net/hlsdh3zwyrtx/2WgzZNttwX5RK4twPtMCsS/64de4333300711282b42046020fc3aa0/Forest_Lake_20191220.wav" },
  { id: 10056, name: "Calm Sea", url: "https://assets.ctfassets.net/hlsdh3zwyrtx/1LelwPIVm5YZle7WP42u2X/b26f1d8a35b4c083a0bb65c9e323b7a7/Calm_Sea_20191220.wav" },
  { id: 10148, name: "Crickets", url: "https://assets.ctfassets.net/hlsdh3zwyrtx/5X1S7xtEHyZab67wRbsEda/92f8bc6c927a384bd2262ebc6999465a/010_crickets16.wav" },
  { id: 10195, name: "Campfire Lake", url: "https://assets.ctfassets.net/hlsdh3zwyrtx/6Gb9MNlL9VcMcUmo4jzCSv/c457b63210359467e729fe7c1d624edd/Campfire_Lake_2_20210412.wav" },
  { id: 10192, name: "Brahms", url: "https://assets.ctfassets.net/hlsdh3zwyrtx/2XXRwK0Xqw1KLBr28RIkSe/ee6af976c9980823389134eeded7f07b/011_brahms16.wav" },
  { id: 10193, name: "Twinkle", url: "https://assets.ctfassets.net/hlsdh3zwyrtx/69qMR6Wp2hPD7gk7hSfRl5/25af4cefe997d5ba4070e71ae21e7eb3/013_twinkle16.wav" },
  { id: 10194, name: "Rock-a-Bye", url: "https://assets.ctfassets.net/hlsdh3zwyrtx/7lY2LJerpBhO7vravoQ14J/debcf202883c61eaa384ee826dec4026/014_rockabye16.wav" },
];

export const REST_PLUS_TRACKS = [
  { id: 0, name: "None" }, { id: 2, name: "Stream" }, { id: 3, name: "Pink Noise" }, { id: 4, name: "Dryer" },
  { id: 5, name: "Ocean" }, { id: 6, name: "Wind" }, { id: 7, name: "Rain" }, { id: 9, name: "Bird" },
  { id: 10, name: "Crickets" }, { id: 11, name: "Brahms" }, { id: 13, name: "Twinkle" }, { id: 14, name: "Rock-a-Bye" },
];

export const toPercent = (value: number) => Math.round(value / MAX_IOT_VALUE * 100);
export const fromPercent = (percent: number) => Math.round(percent / 100 * MAX_IOT_VALUE) & 0xffff;
export const toByte = (value: number) => Math.round(value / MAX_IOT_VALUE * 255);
export const fromByte = (value: number) => Math.round(value / 255 * MAX_IOT_VALUE) & 0xffff;
const hexColor = (r = 0, g = 0, b = 0) => `#${[r, g, b].map((v) => toByte(v).toString(16).padStart(2, "0")).join("")}`;
const record = (value: unknown): Record<string, any> => value && typeof value === "object" ? value as Record<string, any> : {};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayMask = (days: FavoritePatch["days"]): number => {
  if (days === "every day") return 127;
  if (days === "weekdays") return 62;
  if (days === "weekends") return 65;
  if (days === "none") return 0;
  return (days ?? []).reduce((mask, day) => {
    const index = DAYS.findIndex((value) => value.toLowerCase() === day.slice(0, 3).toLowerCase());
    if (index < 0) throw new Error(`Unknown weekday "${day}".`);
    return mask | 1 << index;
  }, 0);
};
const summarizeDays = (mask: number): string[] | string => mask === 127 ? "every day" : mask === 62 ? "weekdays" : mask === 65 ? "weekends" : mask === 0 ? "none" : DAYS.filter((_, index) => mask & 1 << index);

export function summarize(device: Device, reported: unknown, favorites: Favorite[] = [], content: ContentItem[] = []) {
  const state = record(reported), supported = RIOT_PRODUCTS.has(device.product) || device.product === "restPlus";
  const common = { name: device.name, product: device.product, marketingName: device.productDevice?.marketingName, supported, online: state.connected === true, battery: state.deviceInfo?.b, firmware: state.deviceInfo?.f ?? device.productDevice?.firmwareVersion };
  if (!supported) return common;
  if (device.product === "restPlus") {
    const color = record(state.c), rgb = hexColor(color.r, color.g, color.b), lightOff = !color.R && !color.W && !color.r && !color.g && !color.b;
    return { ...common, on: state.isPowered === true, sound: REST_PLUS_TRACKS.find((x) => x.id === state.a?.t)?.name ?? state.a?.t, volume: toPercent(state.a?.v ?? 0), light: { rgb, brightness: lightOff ? 0 : toPercent(color.i ?? 0) } };
  }
  const current = record(state.current), color = record(current.color), sound = record(current.sound);
  const liveColor = content.find((x) => x.contentType === "color" && x.id === color.id), liveSound = content.find((x) => x.contentType === "sound" && x.id === sound.id);
  const colorName = color.id === NO_COLOR_ID ? "off" : color.id === CUSTOM_COLOR_ID ? "custom" : (liveColor?.title ?? COLORS.find((x) => x.id === color.id)?.name ?? "custom").toLowerCase();
  return {
    ...common, charging: state.deviceInfo?.powerStatus === 3 || state.deviceInfo?.powerStatus === 5,
    playing: current.playing === "remote" ? "sound" : current.playing ?? "none",
    favorite: current.playing === "routine" ? favorites.find((x) => x.id === current.srId)?.name : undefined,
    sound: liveSound?.title ?? SOUNDS.find((x) => x.id === sound.id)?.name ?? sound.id,
    volume: toPercent(sound.v ?? 0),
    light: { color: colorName, rgb: hexColor(color.r, color.g, color.b), brightness: color.id === NO_COLOR_ID ? 0 : toPercent(color.i ?? 0) },
    clock: { on: Boolean((state.clock?.flags ?? 0) & RIOT_FLAGS_CLOCK_ON), brightness: toPercent(state.clock?.i ?? 0) },
    toddlerLock: state.toddlerLockOn ?? state.toddlerLock?.turnOnMode === "always",
  };
}

export function summarizeFavorite(routine: Favorite, content: ContentItem[] = []) {
  return {
    id: routine.id, name: routine.name, type: routine.type, enabled: routine.enabled, active: routine.active,
    schedule: routine.startTime ? { time: routine.startTime.slice(11, 16), days: summarizeDays(routine.daysOfWeek ?? 0) } : null,
    buttons: [routine.button0, routine.button1, routine.button2].flatMap((enabled, button) => enabled ? [button] : []),
    steps: (routine.steps ?? []).map((step) => {
      const sound = record(step.sound), color = record(step.color);
      const soundName = sound.id === NO_SOUND_ID || sound.ignore ? "none" : content.find((x) => x.contentType === "sound" && x.id === sound.id)?.title ?? SOUNDS.find((x) => x.id === sound.id)?.name ?? sound.id;
      const knownColor = content.find((x) => x.contentType === "color" && x.id === color.id)?.title ?? COLORS.find((x) => x.id === color.id)?.name;
      const colorName = color.id === NO_COLOR_ID || color.ignore ? "off" : color.id === CUSTOM_COLOR_ID || !knownColor ? "custom" : knownColor;
      return {
        name: step.name, sound: soundName, volume: toPercent(sound.v ?? 0), color: colorName,
        ...(colorName === "custom" ? { rgb: hexColor(color.r, color.g, color.b) } : {}),
        brightness: colorName === "off" ? 0 : toPercent(color.i ?? 0),
        duration_minutes: sound.duration ? Math.round(sound.duration / 60) : null, until: sound.until,
      };
    }),
  };
}

export function patchFavorite(routine: Favorite, patch: FavoritePatch, content: ContentItem[] = []): Favorite {
  const next: Favorite = { ...routine };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.enabled !== undefined) next.enabled = patch.enabled;
  if (patch.start_time !== undefined) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(patch.start_time)) throw new Error("start_time must be HH:MM in 24-hour time.");
    next.startTime = `${routine.startTime?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)} ${patch.start_time}:00`;
  }
  if (patch.days !== undefined) next.daysOfWeek = dayMask(patch.days);
  const sound = patch.sound === undefined ? undefined : findSound("riot", String(patch.sound), content);
  const color = patch.color === undefined ? undefined : parseColor(patch.color.toLowerCase() === "off" ? "No Color" : patch.color, content);
  next.steps = (routine.steps ?? []).map((step) => ({
    ...step,
    sound: { ...step.sound,
      ...(sound ? { id: sound.id, ignore: false } : {}),
      ...(patch.volume === undefined ? {} : { v: fromPercent(patch.volume) }),
      ...(patch.duration_minutes === undefined ? {} : patch.duration_minutes === 0 ? { until: "indefinite", duration: null } : { until: "duration", duration: patch.duration_minutes * 60 }),
    },
    color: { ...step.color,
      ...(color ? { id: color.id, r: color.r, g: color.g, b: color.b, w: color.w, ignore: false } : {}),
      ...(patch.brightness === undefined ? {} : { i: fromPercent(patch.brightness) }),
    },
  }));
  return next;
}

export const volumeDesired = (product: string, volume: number) => product === "restPlus" ? { a: { v: fromPercent(volume) } } : { current: { sound: { v: fromPercent(volume) } } };
export const favoriteDesired = (id: number) => ({ current: { srId: id, step: 1, playing: "routine" } });
export const soundDesired = (product: string, sound: Sound | { id: number }, volume?: number) => product === "restPlus"
  ? { a: { t: sound.id, ...(volume === undefined ? {} : { v: fromPercent(volume) }) }, isPowered: true }
  : { current: { playing: "remote", step: 1, sound: { id: sound.id, url: (sound as Sound).url, mute: false, until: "indefinite", duration: 0, ...(volume === undefined ? {} : { v: fromPercent(volume) }) } } };
export const turnOffDesired = (product: string) => product === "restPlus" ? { isPowered: false } : { current: { srId: 0, step: 0, playing: "none" } };
export const lightDesired = (product: string, color: Color, brightness: number, playing = "none") => {
  const c = { r: color.r, g: color.g, b: color.b, i: fromPercent(brightness), ...(product === "restPlus" ? { W: false, R: false } : { id: color.id, w: color.w }) };
  if (product === "restPlus") return { c, isPowered: true };
  return { current: { ...(playing === "none" ? { srId: 0, step: 0, playing: "remote" } : {}), color: c } };
};
export const lightOffDesired = (product: string, playing = "none") => product === "restPlus"
  ? { c: { r: 0, g: 0, b: 0, i: 0, W: false, R: false } }
  : { current: { ...(playing === "remote" ? { playing: "none" } : {}), color: { id: NO_COLOR_ID, r: 0, g: 0, b: 0, w: 0 } } };
export const clockDesired = (on: boolean, brightness: number | undefined, flags: number) => ({ clock: on ? { flags: flags | RIOT_FLAGS_CLOCK_ON, i: fromPercent(brightness ?? 0) } : { flags: flags & ~RIOT_FLAGS_CLOCK_ON, i: 655 } });
export const toddlerLockDesired = (on: boolean) => ({ toddlerLock: { turnOnMode: on ? "always" : "never" } });

export function parseColor(value: string, content: ContentItem[] = []): Color {
  const live = content.filter((x) => x.contentType === "color").find((x) => x.title.toLowerCase() === value.toLowerCase());
  if (live) return { id: live.id, name: live.title, r: live.red ?? 0, g: live.green ?? 0, b: live.blue ?? 0, w: live.white ?? 0 };
  const catalog = COLORS.find((x) => x.name.toLowerCase() === value.toLowerCase()); if (catalog) return catalog;
  const match = /^#([0-9a-f]{6})$/i.exec(value); if (!match) throw new Error(`Unknown color "${value}". Use a catalog name or #rrggbb.`);
  return { id: CUSTOM_COLOR_ID, name: "Custom", r: fromByte(parseInt(match[1].slice(0, 2), 16)), g: fromByte(parseInt(match[1].slice(2, 4), 16)), b: fromByte(parseInt(match[1].slice(4), 16)), w: 0 };
}

export function findSound(product: string, value: string, content: ContentItem[] = []): Sound | { id: number; name: string } {
  const id = /^\d+$/.test(value) ? Number(value) : undefined;
  if (product === "restPlus") {
    const found = REST_PLUS_TRACKS.find((x) => x.id === id || x.name.toLowerCase() === value.toLowerCase());
    if (!found || found.id === 0) throw new Error(`Unknown Rest+ sound "${value}".`); return found;
  }
  const live = content.filter((x) => x.contentType === "sound").find((x) => x.id === id || x.title.toLowerCase() === value.toLowerCase());
  if (live && (live.wavUrl || live.mp3Url)) return { id: live.id, name: live.title, url: live.wavUrl ?? live.mp3Url! };
  const found = SOUNDS.find((x) => x.id === id || x.name.toLowerCase() === value.toLowerCase());
  if (!found) throw new Error(`Unknown sound "${value}".`); return found;
}
