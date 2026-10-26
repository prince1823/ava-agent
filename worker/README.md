# Ava Agent Worker

Cloudflare Workers + Durable Objects port of `server/` — this replaces the
Node/WebSocket server that used to run on your Mac. Same agent loop, same
tool-calling protocol, same `/health` and `/memory/extract` endpoints; the
app's WebSocket client ([agentStore.ts](../app/src/store/agentStore.ts)) does
not need any code changes, only a URL change in Settings.

## Why a Durable Object

Each WebSocket connection gets its own `AvaAgent` Durable Object instance
(`src/index.ts`), mirroring the original server where conversation state
lived inside the `wss.on("connection", ...)` closure. The one upgrade: each
DO also mirrors its conversation history to its own embedded SQLite
(`src/AvaAgent.ts`), so a turn survives the DO hibernating mid-conversation
(e.g. the phone goes idle for a while) — something the original in-memory-only
server couldn't do. A full reconnect still relies on the client's `seed`
(last ~14 messages), unchanged from the original design.

## First-time setup

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars   # then paste your real OpenRouter key
```

## Local development

```bash
npm run dev
```

Starts on `http://localhost:8787` (wrangler's default) or whatever port you
pass with `--port`. Point the app's `ws_url` setting at
`ws://<your-Mac's-LAN-IP>:8787/agent` while developing — same as before,
just now talking to the Worker instead of the Node server.

## Deploy to Cloudflare (removes the "run the Mac" requirement)

```bash
npx wrangler login          # once
npx wrangler secret put OPENROUTER_API_KEY
npm run deploy
```

This prints your Worker's URL, e.g. `https://ava-agent-worker.<subdomain>.workers.dev`.
In the app's **Settings → ws_url**, set:

```
wss://ava-agent-worker.<subdomain>.workers.dev/agent
```

From then on the phone talks straight to Cloudflare — no Mac, no local
process to keep alive.

## Config

- `AGENT_MODEL` — in `wrangler.jsonc` under `vars`. Change the OpenRouter
  model id there and redeploy.
- `OPENROUTER_API_KEY` — a secret, never committed. Set via
  `wrangler secret put` (production) or `.dev.vars` (local only, gitignored).

## Regenerating types

After editing `wrangler.jsonc` (bindings, vars), run:

```bash
npx wrangler types
```
