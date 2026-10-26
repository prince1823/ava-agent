import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { runAgentTurn } from "./agentLoop";
import { extractProfile, type MemoryMessage } from "./memory";
import { followUps } from "./suggestions";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, model: process.env.AGENT_MODEL ?? "openai/gpt-4o-mini" });
});

app.post("/memory/extract", async (req, res) => {
  try {
    const { messages, existing, facts } = req.body ?? {};
    if (!Array.isArray(messages)) {
      res.status(400).json({ error: "messages must be an array" });
      return;
    }
    const clean: MemoryMessage[] = messages
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
      .map((m: any) => ({ role: m.role, text: m.text, at: String(m.at ?? "") }));
    const profile = await extractProfile(clean, existing ?? null, Array.isArray(facts) ? facts : []);
    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Memory extraction failed" });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/agent" });

type ClientMessage =
  | {
      type: "user_message";
      text: string;
      clientDate: string;
      timeZone: string;
      upcoming?: string;
      conversationId?: string;
      seed?: Array<{ role: "user" | "assistant"; text: string }>;
      profile?: unknown;
      commitments?: unknown;
      regenerate?: boolean;
    }
  | { type: "tool_result"; callId: string; result: unknown }
  | { type: "cancel" };

wss.on("connection", (socket: WebSocket) => {
  // One live history per conversation, so switching chats never leaks context between them.
  const histories = new Map<string, ChatCompletionMessageParam[]>();
  const pendingToolResults = new Map<string, (value: unknown) => void>();
  let turnInFlight = false;
  let stopRequested = false;

  const send = (payload: unknown) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };

  socket.on("message", async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send({ type: "error", message: "Malformed message" });
      return;
    }

    if (msg.type === "tool_result") {
      const resolve = pendingToolResults.get(msg.callId);
      if (resolve) {
        pendingToolResults.delete(msg.callId);
        resolve(msg.result);
      }
      return;
    }

    if (msg.type === "cancel") {
      console.log("[cancel] received, turnInFlight =", turnInFlight);
      if (!turnInFlight) return;
      stopRequested = true;
      // Unblock any tool call that is waiting on the phone.
      for (const [id, resolve] of pendingToolResults) {
        pendingToolResults.delete(id);
        resolve({ error: "Cancelled by user." });
      }
      return;
    }

    if (msg.type === "user_message") {
      if (turnInFlight) {
        send({ type: "error", message: "A turn is already in progress." });
        return;
      }
      turnInFlight = true;
      stopRequested = false;

      const conversationId = msg.conversationId ?? "default";
      let history = histories.get(conversationId);
      if (!history) {
        history = (msg.seed ?? [])
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
          .map((m) => ({ role: m.role, content: m.text }) as ChatCompletionMessageParam);
        histories.set(conversationId, history);
      }

      if (msg.regenerate) {
        // Drop the last user message and everything the assistant did after it, then redo it.
        let lastUser = -1;
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].role === "user") {
            lastUser = i;
            break;
          }
        }
        if (lastUser >= 0) history.length = lastUser;
      }

      history.push({
        role: "user",
        content: `[current local date/time: ${msg.clientDate}, timezone: ${msg.timeZone}${
          msg.upcoming ? `, upcoming days: ${msg.upcoming}` : ""
        }] ${msg.text}`,
      });

      const awaitToolResult = (callId: string) =>
        new Promise<unknown>((resolve) => {
          pendingToolResults.set(callId, resolve);
        });

      let reply = "";
      let finished = false;
      try {
        for await (const event of runAgentTurn(history, awaitToolResult, {
          profile: msg.profile,
          commitments: msg.commitments,
          shouldStop: () => stopRequested,
        })) {
          if (event.type === "delta") reply += event.text;
          if (event.type === "done") finished = true;
          send(event);
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        turnInFlight = false;
      }

      // Follow-up chips are generated after the answer, so they never delay it.
      if (finished && !stopRequested && reply.trim()) {
        followUps(msg.text, reply)
          .then((items) => items.length && send({ type: "suggestions", items }))
          .catch(() => {});
      }
    }
  });

  send({ type: "connected" });
});

const PORT = Number(process.env.PORT ?? 8787);
server.listen(PORT, () => {
  console.log(`Ava agent server listening on :${PORT} (ws path /agent)`);
});
