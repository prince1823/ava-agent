# Ava — An On-Device Personal Agent

A React Native app with a real tool-calling LLM agent that reads/writes your **actual** calendar,
schedules **real** local notifications, tracks expenses in a local SQLite DB, and remembers facts
about you across sessions — with a streaming chat UI and human-in-the-loop confirmation before any
real-world action.

```
react native/
├── app/     Expo Router app (the mobile client)
└── server/  Node backend that runs the agentic tool-calling loop (OpenRouter + gpt-4o-mini)
```

## Why this architecture is the interesting part

Calendar access, local notifications, GPS, and on-device SQLite are **native device APIs** — they
can only run on the phone, never on a server. So the agent reasoning loop and the tool execution
are split across a network boundary:

1. The **server** holds the OpenRouter API key and runs the step-by-step agent loop
   (`server/src/agentLoop.ts`), streaming text tokens back over a WebSocket as they're generated.
2. When the model decides to call a tool (e.g. `create_calendar_event`), the server does **not**
   execute it — it can't, it has no access to the user's phone. Instead it emits a
   `tool_call_start` event and **suspends that step of the loop**, awaiting a result.
3. The **client** (the phone) receives the request, runs the real native code
   (`app/src/tools/*.ts`), and — for anything that mutates real state — shows a confirmation sheet
   first. Once resolved, it sends `{ type: "tool_result", callId, result }` back over the same
   socket.
4. The server resumes the loop with that result appended to the conversation and continues
   reasoning, possibly calling more tools, until it has a final answer.

This is the same tool-use pattern behind agent frameworks, adapted for the fact that the "hands" of
the agent (device APIs) and its "brain" (the LLM) live on two different machines.

## Features

- Multi-step agentic tool use (OpenAI-style function calling against OpenRouter)
- Streaming assistant responses, token by token
- Live "tool call" cards in the chat UI (📅 Creating calendar event… → Done)
- Human-in-the-loop confirmation sheet before any destructive/real-world action
- Real calendar read/write (`expo-calendar`)
- Real local notification scheduling (`expo-notifications`)
- Real device location + reverse geocoding (`expo-location`)
- Local SQLite expense tracker the agent can query and append to (`expo-sqlite`)
- Durable cross-session memory ("remember I'm vegetarian") backed by SQLite
- Text-to-speech playback of any reply (`expo-speech`), plus on-device voice input
  — tap the mic, speak, it transcribes into the composer (`expo-speech-recognition`)
- **Promises** — Ava tracks intentions ("I promised Priya I'd send the invoice by Friday"),
  follows up, and can draft the message. Reaches the agent as a data-only context block.
- **Simulator** — a dry-run engine for "what if" questions: it reads real calendar,
  spending and reminders, changes nothing, and returns a timeline plus a before/after
  impact diff with conflicts and anything irreversible.
- **Privacy ledger** — every outbound request is recorded locally with its purpose and
  size (metadata only, never payloads), plus a cloud-minimised mode that skips optional
  memory extraction and follow-up suggestions.
- **Ambient reminders** — commitment reminders deep-link back to the right screen and
  carry a "Mark done" action (native only).
- Dark, custom chat UI (no off-the-shelf chat-UI library)
- **Runs in a browser** — the same codebase serves a web build with simulated device
  tools, so you can iterate without a phone or emulator. See below.

## Setup

### 1. Server

```bash
cd server
npm install
cp .env.example .env
# edit .env and put in your OpenRouter key: https://openrouter.ai/keys
npm run dev
```

This starts the WebSocket agent server on `:8787`.

**Model cost note:** `openai/gpt-4o-mini` via OpenRouter is *very* cheap but not free (~$0.15 /
1M input tokens) — fine for demo/dev use. To run at $0, set `AGENT_MODEL` in `.env` to a
`:free`-suffixed OpenRouter model (e.g. a Llama/Gemini-flash free variant) — tool-calling
reliability varies by model, so test before a demo.

### 2. Mobile app

Calendar/notifications/location are native modules **not available in Expo Go** — you need a
development build:

```bash
cd app
npm install
npx expo prebuild
npx expo run:ios      # or: npx expo run:android
```

Before running, point the app at your server. Since your phone/simulator and your server are
separate network participants, set your machine's LAN IP (not `localhost`) in an env file:

```bash
# app/.env
EXPO_PUBLIC_AGENT_WS_URL=ws://<your-machine-LAN-IP>:8787/agent
```

Find your LAN IP with `ipconfig getifaddr en0` (Mac Wi-Fi) or `ifconfig`.

### 3. Browser (fastest loop, no device needed)

The app also runs as a web build. Native-only capabilities are replaced by platform
variants (`*.web.ts`) behind the same tool names, so nothing native is touched:

```bash
cd app
npm install                              # if you have not installed dependencies yet
npx expo install react-dom react-native-web @expo/metro-runtime  # one-off, resolves SDK-compatible versions
npx expo start --web                     # http://localhost:8081
```

`app/src/config.ts` defaults to `ws://localhost:8787/agent`, so the browser talks to a
server on the same machine with no LAN IP.

What is real on web: chat, streaming, tool cards, confirmations, undo, expenses, memory,
conversations, location, voice input, CSV download, read-aloud, Promises, Simulator and
the privacy ledger. What is simulated: calendar, contacts and SMS (fixture data) and
scheduled notifications. Biometric lock is off, because browsers have no such hardware.

`npx expo export --platform web` produces a static build in `dist/` if you want to host it;
a hosted page needs the server reachable over `wss://` instead of `ws://`.

## Demo script for an interview

1. "What's on my calendar today?" → watch it call `list_calendar_events` live.
2. "Add a dentist appointment tomorrow at 3pm and remind me an hour before" → multi-step: creates
   a calendar event **and** schedules a notification, chained in one turn — then shows the
   confirmation sheet for each real action before committing.
3. "How much did I spend on food this week?" → queries the local SQLite expense DB.
4. "Remember that I'm vegetarian" then, in a later session, "What do you remember about me?" →
   durable memory across app restarts.
5. "I promised Priya I'd send the invoice by Friday — keep me to it" → Ava resolves the
   weekday from the injected date table and files a promise. Open **Promises** to finish it,
   set a reminder, or have Ava draft the message.
6. "What if I skip the gym tonight and order takeaway?" → `simulate_plan` dry-runs the plan:
   timeline, spending delta, conflicts and anything irreversible, with nothing written.
   The same result renders on the **Simulator** screen.
7. Open **Privacy** → every outbound request, what it was for and how big it was. Toggle
   cloud-minimised mode and watch the optional calls stop.

Talking points if asked "why is this hard": the client/server tool-execution split, streaming over
a mobile connection, human-in-the-loop confirmation as an agent-safety pattern, and that the
backend never ships the API key to the device. Also worth mentioning: the simulator gives the
agent a safe way to reason about consequences, and the promise tracker turns a one-off chat into
something that survives the session.
