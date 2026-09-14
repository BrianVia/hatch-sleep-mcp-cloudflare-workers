# hatch-sleep-mcp-cloudflare-workers

A remote [Model Context Protocol](https://modelcontextprotocol.io/) server for one Hatch account, hosted on Cloudflare Workers. It reads and controls supported Hatch Rest sound machines over their unofficial REST and AWS IoT interfaces.

One Worker serves a bearer-protected, stateless `/mcp` endpoint. A Durable Object owns the Hatch session, cached device data, and short-lived AWS credentials.

## Setup

```sh
npm install
npx wrangler login
cp wrangler.jsonc wrangler.local.jsonc
```

In `wrangler.local.jsonc`, replace `hatch.example.com` with a hostname on a Cloudflare zone you manage. Deploy using that local config:

```sh
WRANGLER_CONFIG=wrangler.local.jsonc npm run deploy
npx wrangler secret put HATCH_EMAIL --config wrangler.local.jsonc
npx wrangler secret put HATCH_PASSWORD --config wrangler.local.jsonc
openssl rand -hex 32 | tee /dev/stderr | npx wrangler secret put MCP_BEARER --config wrangler.local.jsonc
```

The custom-domain route creates its DNS record on first deploy.

## Tools

| Tool | Description |
|---|---|
| `list_devices` | List all devices with live state and supported-model summaries |
| `get_device` | Get raw reported shadow state for one device |
| `list_favorites` | List favorites for a riot-family device |
| `play_favorite` | Play a favorite by name or ID |
| `update_favorite` | Edit an existing favorite's schedule and content |
| `play_sound` | Play a catalog sound, optionally at a set volume |
| `set_volume` | Set sound volume |
| `set_light` | Set a named or custom RGB light color and brightness |
| `light_off` | Turn off the light |
| `turn_off` | Turn off sound and light |
| `set_clock` | Control clock visibility and brightness on riot-family devices |
| `set_toddler_lock` | Control toddler lock on riot-family devices |

Write tools change a real device immediately. Confirm with the user before playing sounds or changing lights at night. Writes return the desired shadow payload without reading it back; call `list_devices` to confirm.

`update_favorite` edits an existing favorite in the Hatch cloud; create new favorites in the Hatch app.

## Supported models

The `riot`, `riotPlus`, and `restBaby` product families and first-generation `restPlus` are supported. Other devices in the account appear in `list_devices` with `supported: false`, and write tools refuse to change them.

## Raw HTTP

The endpoint uses stateless Streamable HTTP and returns SSE-framed MCP responses.

```sh
curl -s https://hatch.example.com/mcp -X POST \
  -H 'Authorization: Bearer <MCP_BEARER>' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

`GET /` identifies the MCP endpoint. `GET /health` is public and reports cached login and AWS credential status without making a network request.

## Local development

```sh
cp .dev.vars.example .dev.vars
npm run check
npx wrangler dev
```

## How it works

The Worker logs in through Hatch REST, exchanges Hatch's Cognito identity token for temporary AWS credentials, and caches them in a Durable Object. Reads use a short-lived MQTT 3.1.1 WebSocket session to request AWS IoT shadows. Writes use SigV4-signed HTTPS shadow publishes. No MQTT or AWS SDK is required.

This integration uses unofficial Hatch APIs and may break if Hatch changes them. Credentials remain Worker secrets and are sent only to Hatch and AWS Cognito. `/mcp` requires `MCP_BEARER`; `/` and `/health` are public.

## License

MIT. See [LICENSE](LICENSE).
