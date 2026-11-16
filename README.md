# Ava — An On-Device Personal Agent

Ava is a mobile AI assistant that actually **does things**: it reads and writes your real
calendar, schedules real local notifications, tracks expenses in an on-device SQLite database,
remembers facts about you across sessions, and can plan a trip or draft a message — all through a
streaming chat UI with human-in-the-loop confirmation before anything real-world happens.

**Live demo:** _link goes here once deployed_

```
ava-agent/
├── app/     Expo Router app — the mobile/web client (React Native)
└── worker/  Cloudflare Worker — the agentic tool-calling loop (OpenRouter)
```

## Why this architecture is the interesting part

Calendar access, local notifications, GPS, and on-device SQLite are **native device APIs** — they
can only run on the phone, never on a server. So the agent's reasoning loop and its tool execution
are split across a network boundary, each running where it has to:

1. The **worker** (Cloudflare Workers + Durable Objects) holds the OpenRouter API key and runs the
   step-by-step agent loop (`worker/src/agentLoop.ts`), streaming text tokens back over a
   WebSocket as they're generated. Each connection gets its own `AvaAgent` Durable Object, so
   conversation state survives the socket hibernating mid-chat.
2. When the model decides to call a tool (e.g. `create_calendar_event`), the worker does **not**
   execute it — it can't, it has no access to the user's phone. Instead it emits a
   `tool_call_start` event and **suspends that step of the loop**, awaiting a result.
3. The **client** (the phone) receives the request, runs the real native code
   (`app/src/tools/*.ts`), and — for anything that mutates real state — shows a confirmation sheet
   first. Once resolved, it sends `{ type: "tool_result", callId, result }` back over the same
   socket.
4. The worker resumes the loop with that result appended to the conversation and keeps reasoning,
   possibly calling more tools, until it has a final answer.

This is the same tool-use pattern behind agent frameworks like LangChain or OpenAI's Assistants
API, adapted for the fact that the agent's "hands" (device APIs) and its "brain" (the LLM) live on
two different machines.

## Features

- Multi-step agentic tool use (OpenAI-style function calling against OpenRouter)
- Streaming assistant responses, token by token, with resilient background reconnect
- Live "tool call" cards in the chat UI (📅 Creating calendar event… → Done)
- Human-in-the-loop confirmation sheet before any destructive/real-world action
- Real calendar read/write (`expo-calendar`) and calendar invites
- Real local notification scheduling (`expo-notifications`)
- Real device location + reverse geocoding (`expo-location`)
- Local SQLite expense tracker the agent can query and append to (`expo-sqlite`)
- Durable cross-session memory ("remember I'm vegetarian") backed by SQLite
- Vision input — attach a photo and ask the agent about it
- Text-to-speech playback of any reply (`expo-speech`), plus on-device voice input
  — tap the mic, speak, it transcribes into the composer (`expo-speech-recognition`)
- **Trip planner** — turns a travel ask into a day-by-day itinerary card (places, food, cafes,
  estimated cost) rendered directly in the chat
- **Promises** — Ava tracks intentions ("I promised Priya I'd send the invoice by Friday"),
  follows up, and can draft the message
- **Simulator** — a dry-run engine for "what if" questions: it reads real calendar, spending and
  reminders, changes nothing, and returns a timeline plus a before/after impact diff with
  conflicts and anything irreversible
- **Privacy ledger** — every outbound request is recorded locally with its purpose and size
  (metadata only, never payloads), plus a cloud-minimised mode that skips optional memory
  extraction and follow-up suggestions
- Biometric app lock (native only)
- Dark, custom chat UI (no off-the-shelf chat-UI library)
- **Runs in a browser** — the same codebase serves a web build with simulated device tools, so you
  can try it without a phone or emulator. See below.

## Tech stack

| Layer | Tech |
|---|---|
| Mobile/web client | React Native, Expo (Router, SQLite, Calendar, Location, Notifications, Speech) |
| State | Zustand |
| Backend | Cloudflare Workers, Durable Objects (`agents` SDK), WebSockets |
| LLM | OpenRouter (`openai/gpt-4o-mini` by default, swappable) |
| Language | TypeScript end to end |

## Setup

### 1. Worker (backend)

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars   # paste your OpenRouter key: https://openrouter.ai/keys
npm run dev
```

Starts on `http://localhost:8787`. See [worker/README.md](worker/README.md) for the Durable
Object design and how to deploy it to Cloudflare for free (no machine needs to stay on).

**Model cost note:** `openai/gpt-4o-mini` via OpenRouter is *very* cheap but not free (~$0.15 /
1M input tokens) — fine for demo/dev use. To run at $0, set `AGENT_MODEL` in `wrangler.jsonc` to a
`:free`-suffixed OpenRouter model — tool-calling reliability varies by model, so test before a demo.

### 2. Mobile app

Calendar/notifications/location are native modules **not available in Expo Go** — you need a
development build:

```bash
cd app
npm install
npx expo prebuild
npx expo run:ios      # or: npx expo run:android
```

Before running, point the app at your worker. Since your phone/simulator and your machine are
separate network participants, set your machine's LAN IP (not `localhost`) in an env file:

```bash
# app/.env
EXPO_PUBLIC_AGENT_WS_URL=ws://<your-machine-LAN-IP>:8787/agent
```

Find your LAN IP with `ipconfig getifaddr en0` (Mac Wi-Fi) or `ifconfig`.

### 3. Browser (fastest loop, no device needed)

The app also runs as a web build. Native-only capabilities are replaced by platform variants
(`*.web.ts`) behind the same tool names, so nothing native is touched:

```bash
cd app
npm install                              # if you have not installed dependencies yet
npx expo install react-dom react-native-web @expo/metro-runtime  # one-off, resolves SDK-compatible versions
npx expo start --web                     # http://localhost:8081
```

`app/src/config.ts` defaults to `ws://localhost:8787/agent`, so the browser talks to a worker
running on the same machine with no LAN IP.

What is real on web: chat, streaming, tool cards, confirmations, undo, expenses, memory,
conversations, location, voice input, vision input, CSV download, read-aloud, trip planning,
Promises, Simulator and the privacy ledger. What is simulated: calendar, contacts and SMS (fixture
data) and scheduled notifications. Biometric lock is off, because browsers have no such hardware.

`npx expo export --platform web` produces a static build in `dist/` if you want to host it; a
hosted page needs the worker reachable over `wss://` instead of `ws://` (already true once you
deploy the worker — see [worker/README.md](worker/README.md)).
