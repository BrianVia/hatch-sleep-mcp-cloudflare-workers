const enc = new TextEncoder();
const str = (s: string) => { const b = enc.encode(s); return [b.length >> 8, b.length & 0xff, ...b]; };
const remaining = (n: number) => { const out: number[] = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 0x80; out.push(d); } while (n > 0); return out; };
const packet = (type: number, flags: number, body: number[]) => new Uint8Array([(type << 4) | flags, ...remaining(body.length), ...body]);
export const CONNECT = (clientId: string, keepAlive = 30) => packet(1, 0, [...str("MQTT"), 4, 0x02, keepAlive >> 8, keepAlive & 0xff, ...str(clientId)]);
export const SUBSCRIBE = (id: number, topics: string[]) => packet(8, 2, [id >> 8, id & 0xff, ...topics.flatMap((t) => [...str(t), 1])]);
export const PUBLISH = (id: number, topic: string, payload: string) => packet(3, 2, [...str(topic), id >> 8, id & 0xff, ...enc.encode(payload)]);
export const DISCONNECT = () => packet(14, 0, []);
export type Packet = { type: number; flags: number; body: Uint8Array };

export function decode(buf: ArrayBuffer): Packet[] {
  const out: Packet[] = [], b = new Uint8Array(buf); let i = 0;
  while (i < b.length) {
    const type = b[i] >> 4, flags = b[i] & 0x0f; i++;
    let len = 0, mult = 1, d: number; do { d = b[i++]; len += (d & 127) * mult; mult *= 128; } while (d & 128);
    out.push({ type, flags, body: b.subarray(i, i + len) }); i += len;
  }
  return out;
}
export function parsePublish({ flags, body }: Packet) {
  const tl = (body[0] << 8) | body[1], topic = new TextDecoder().decode(body.subarray(2, 2 + tl));
  let i = 2 + tl; if ((flags >> 1) & 3) i += 2;
  return { topic, payload: new TextDecoder().decode(body.subarray(i)) };
}

/** One short-lived MQTT 3.1.1 session that retrieves all requested classic shadows. */
export async function getShadows(url: string, clientId: string, thingNames: string[], timeoutMs = 10_000): Promise<Record<string, unknown>> {
  if (!thingNames.length) return {};
  const ws = new WebSocket(url, ["mqtt"]); ws.binaryType = "arraybuffer";
  const docs: Record<string, unknown> = {}; let id = 1;
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => { if (settled) return; settled = true; clearTimeout(timer); try { ws.close(); } catch {} reject(error); };
    const timer = setTimeout(() => fail(new Error("MQTT timeout")), timeoutMs);
    const done = () => { if (settled) return; settled = true; clearTimeout(timer); try { ws.send(DISCONNECT()); ws.close(); } catch {} resolve(docs); };
    ws.onerror = (event) => fail(new Error(`websocket error: ${"message" in event ? event.message : String(event)}`));
    ws.onopen = () => ws.send(CONNECT(clientId));
    ws.onmessage = ({ data }) => {
      for (const p of decode(data as ArrayBuffer)) {
        if (p.type === 2) {
          if (p.body[1] !== 0) return fail(new Error(`MQTT connect refused: ${p.body[1]}`));
          ws.send(SUBSCRIBE(id++, thingNames.map((t) => `$aws/things/${t}/shadow/get/accepted`)));
        } else if (p.type === 9) {
          for (const thing of thingNames) ws.send(PUBLISH(id++, `$aws/things/${thing}/shadow/get`, ""));
        } else if (p.type === 3) {
          try {
            const { topic, payload } = parsePublish(p), thing = topic.split("/")[2]; docs[thing] = JSON.parse(payload);
            if (Object.keys(docs).length === thingNames.length) done();
          } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
        }
      }
    };
  });
}
