import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { CONNECT, PUBLISH, decode, parsePublish } from "../src/mqtt.ts";
import { presignMqttUrl } from "../src/aws.ts";
import { clockDesired, favoriteMismatches, fromByte, fromPercent, lightDesired, lightOffDesired, parseColor, patchFavorite, soundDesired, summarize, summarizeFavorite, toByte, toPercent } from "../src/hatch.ts";

const fixture = async (name) => JSON.parse(await readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8"));
const favorite = {
  id: 42, name: "Evening", type: "flex", active: true, enabled: true, startTime: "2025-04-09 19:30:00", daysOfWeek: 127,
  button0: true, button1: false, button2: true,
  steps: [{ id: 7, name: "Sleep", sound: { id: 10138, v: 10485, duration: 1800, until: "duration", ignore: false }, color: { id: 9999, r: 65535, g: 30326, b: 0, w: 0, i: 7864, ignore: false } }],
};

describe("Hatch state conversion", () => {
  test("16-bit percentage and color conversions round trip", () => {
    assert.equal(toPercent(22_937), 35);
    assert.equal(fromPercent(35), 22_937);
    assert.equal(toByte(65_535), 255);
    assert.equal(fromByte(255), 65_535);
    assert.deepEqual(parseColor("#ff7600"), { id: 9999, name: "Custom", r: 65535, g: 30326, b: 0, w: 0 });
  });

  test("summarizes riot-family and Rest+ shadows", async () => {
    const riot = (await fixture("riotPlus-shadow.json")).state.reported;
    const restPlus = (await fixture("restPlus-shadow.json")).state.reported;
    const riotSummary = summarize({ name: "Nursery", product: "riotPlus", thingName: "thing-1", macAddress: "00", productDevice: { marketingName: "Rest+ 2nd gen" } }, riot, [{ id: 224934191, name: "Bedtime", type: "sleep", active: true }]);
    assert.equal(riotSummary.playing, "routine");
    assert.equal(riotSummary.favorite, "Bedtime");
    assert.equal(riotSummary.sound, "Ocean");
    assert.equal(riotSummary.volume, 35);
    assert.deepEqual(riotSummary.light, { color: "custom", rgb: "#ff7600", brightness: 12 });
    assert.deepEqual(riotSummary.clock, { on: false, brightness: 25 });
    const plusSummary = summarize({ name: "Bedroom", product: "restPlus", thingName: "thing-2", macAddress: "11" }, restPlus);
    assert.equal(plusSummary.on, false);
    assert.equal(plusSummary.sound, "Ocean");
    assert.equal(plusSummary.volume, 17);
    assert.deepEqual(plusSummary.light, { rgb: "#eb8e48", brightness: 4 });
  });

  test("builds exact product-specific desired state", () => {
    assert.deepEqual(soundDesired("restPlus", { id: 5 }, 20), { a: { t: 5, v: 13107 }, isPowered: true });
    assert.deepEqual(lightDesired("riotPlus", parseColor("Red"), 50, "none"), { current: { srId: 0, step: 0, playing: "remote", color: { r: 65535, g: 0, b: 0, i: 32768, id: 234, w: 0 } } });
    assert.deepEqual(lightOffDesired("riotPlus", "remote"), { current: { playing: "none", color: { id: 9998, r: 0, g: 0, b: 0, w: 0 } } });
    assert.deepEqual(clockDesired(false, undefined, 0x8800), { clock: { flags: 0x0800, i: 655 } });
  });

  test("summarizes and patches a favorite without mutating it", () => {
    assert.deepEqual(summarizeFavorite(favorite), {
      id: 42, name: "Evening", type: "flex", enabled: true, active: true,
      schedule: { time: "19:30", days: "every day" }, buttons: [0, 2],
      steps: [{ name: "Sleep", sound: "Ocean", volume: 16, color: "custom", rgb: "#ff7600", brightness: 12, duration_minutes: 30, until: "duration" }],
    });
    const patched = patchFavorite(favorite, { start_time: "20:00", days: ["Mon", "Wed"], duration_minutes: 0, volume: 50 });
    assert.equal(patched.startTime, "2025-04-09 20:00:00");
    assert.equal(patched.daysOfWeek, 10);
    assert.deepEqual(patched.steps[0].sound, { id: 10138, v: 32768, duration: null, until: "indefinite", ignore: false });
    assert.equal(favorite.startTime, "2025-04-09 19:30:00");
  });

  test("patches hex color, sound, and button, dropping stale contentfulIds", () => {
    const noColor = { ...favorite, button0: false, steps: [{ ...favorite.steps[0], sound: { ...favorite.steps[0].sound, id: 10139, contentfulId: "rain" }, color: { id: 9998, contentfulId: "none", r: 0, g: 0, b: 0, w: 0, i: 0, ignore: false } }] };
    const patched = patchFavorite(noColor, { color: "#FF7600", brightness: 10, sound: "Ocean", volume: 35, button: true });
    assert.equal(patched.button0, true);
    assert.deepEqual(patched.steps[0].color, { id: 9999, contentfulId: undefined, r: 65535, g: 30326, b: 0, w: 0, i: 6554, ignore: false });
    assert.equal(JSON.stringify(patched.steps[0].sound).includes("contentfulId"), false);
    assert.deepEqual(summarizeFavorite(patched).steps[0], { name: "Sleep", sound: "Ocean", volume: 35, color: "custom", rgb: "#ff7600", brightness: 10, duration_minutes: 30, until: "duration" });
    assert.deepEqual(summarizeFavorite(patched).buttons, [0, 2]);
  });

  test("lists favorite fields that did not persist", () => {
    const expected = summarizeFavorite(patchFavorite(favorite, { volume: 35, color: "#ff7600" }));
    assert.deepEqual(favoriteMismatches(expected, { ...summarizeFavorite(favorite), id: 99 }), ['steps[0].volume (wanted 35, got 16)']);
    assert.deepEqual(favoriteMismatches(expected, { ...expected, id: 99, active: false }), []);
  });
});

describe("MQTT", () => {
  test("CONNECT encodes MQTT 3.1.1 clean-session bytes", () => {
    assert.deepEqual([...CONNECT("abc")], [16, 15, 0, 4, 77, 81, 84, 84, 4, 2, 0, 30, 0, 3, 97, 98, 99]);
  });

  test("decodes and parses a QoS 1 PUBLISH frame", () => {
    const encoded = PUBLISH(7, "$aws/things/demo/shadow/get/accepted", '{"state":{"reported":{"connected":true}}}');
    const packets = decode(encoded.buffer);
    assert.equal(packets.length, 1);
    assert.equal(packets[0].type, 3);
    assert.deepEqual(parsePublish(packets[0]), { topic: "$aws/things/demo/shadow/get/accepted", payload: '{"state":{"reported":{"connected":true}}}' });
  });
});

test("MQTT presign URL has the expected fixed-date SigV4 shape", async () => {
  const RealDate = Date;
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ["2026-09-14T12:34:56.000Z"])); } static now() { return new RealDate("2026-09-14T12:34:56.000Z").valueOf(); } };
  try {
    const url = await presignMqttUrl("example-ats.iot.us-west-2.amazonaws.com", "us-west-2", { accessKeyId: "AKIDEXAMPLE", secretKey: "secret", sessionToken: "token+/=" });
    assert.match(url, /^wss:\/\/example-ats\.iot\.us-west-2\.amazonaws\.com\/mqtt\?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIDEXAMPLE%2F20260914%2Fus-west-2%2Fiotdevicegateway%2Faws4_request&X-Amz-Date=20260914T123456Z&X-Amz-SignedHeaders=host&X-Amz-Signature=[0-9a-f]{64}&X-Amz-Security-Token=token%2B%2F%3D$/);
  } finally { globalThis.Date = RealDate; }
});
