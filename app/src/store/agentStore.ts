import { create } from "zustand";
import * as Haptics from "expo-haptics";
import { executeTool, type ToolName } from "../tools";
import { agentWsUrl } from "../config";
import { loadProfile, scheduleProfileRefresh } from "../memory/profile";
import { cloudMinimised, recordOutbound } from "../privacy/ledger";
import type { AgentMode, ChatMessage, ClientMessage, ServerEvent, ToolCall } from "../types/agent";
import { simulatePlan, type SimulatedAction, type SimulationResult } from "../tools/simulate";
import {
  createConversation,
  deleteChatMessage,
  deleteConversation,
  listChatMessages,
  listCommitments,
  listConversations,
  saveChatMessage,
  touchConversation,
  type ConversationRow,
} from "../db/db";

// A local wall-clock ISO string with no 'Z'/offset suffix — this is what every
// datetime the agent produces (and what we send it as "now") must use, so a
// string like "15:00" always means 3pm in the user's own timezone, never UTC.
function localIsoNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

// The weekday is sent alongside the timestamp so the model never has to derive it:
// asking a model to work out which date "Friday" is produced wrong answers.
function localWeekday(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

// A literal weekday -> date table for the next two weeks. Models are unreliable at
// date arithmetic; giving them the answer removes the whole class of error.
function upcomingDays(days = 14): string {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    const pad = (n: number) => String(n).padStart(2, "0");
    out.push(`${weekday} ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  return out.join(", ");
}

type ConnectionStatus = "connecting" | "open" | "closed" | "error";

interface PendingConfirmation {
  messageId: string;
  callId: string;
  name: string;
  args: Record<string, any>;
}

interface AgentState {
  messages: ChatMessage[];
  status: ConnectionStatus;
  isStreaming: boolean;
  pendingConfirmation: PendingConfirmation | null;
  socket: WebSocket | null;
  conversationId: string | null;
  conversations: ConversationRow[];
  suggestions: string[];
  /** Most recent simulate_plan result, surfaced by the Simulator screen. */
  lastSimulation: SimulationResult | null;
  /** Composer mode selector — steers the next turn (chat/plan/promise), like Claude's mode toggle. */
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
  connect: () => void;
  sendMessage: (text: string, opts?: { regenerate?: boolean; image?: string }) => void;
  stopGeneration: () => void;
  regenerateLast: () => void;
  confirmPending: (approve: boolean) => void;
  /** Run a dry-run simulation and store it for the Simulator screen. */
  runSimulation: (args: { actions: SimulatedAction[]; horizon?: "day" | "week"; start?: string }) => Promise<void>;
  initConversations: () => void;
  refreshConversations: () => void;
  newConversation: () => void;
  switchConversation: (id: string) => void;
  removeConversation: (id: string) => void;
}

type SetFn = (partial: Partial<AgentState> | ((s: AgentState) => Partial<AgentState>)) => void;

// Bookkeeping for which assistant message the currently-streaming turn belongs to.
// Pure plumbing, not UI state, so it lives outside the reactive store.
let activeAssistantId: string | null = null;
// Conversations the current socket already holds history for. A new socket (or a chat opened for the
// first time on it) is seeded with the recent messages so Ava keeps the context.
const seededConversations = new Set<string>();

// Android (and iOS, less aggressively) kills the TCP connection once the app is
// backgrounded/locked for a while — the socket's onclose fires, but nothing
// reconnected it before, so the send button looked "stuck" until a full app
// restart. Reconnect automatically with backoff, and also eagerly on app
// foreground (see _layout.tsx) so resuming from lock feels instant.
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

function scheduleReconnect(connect: () => void) {
  if (reconnectTimer) return;
  const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function titleFromText(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 48 ? trimmed.slice(0, 48) + "…" : trimmed || "New chat";
}

function updateMessage(messages: ChatMessage[], id: string, patch: Partial<ChatMessage>): ChatMessage[] {
  return messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

function updateToolCall(
  messages: ChatMessage[],
  messageId: string,
  callId: string,
  patch: Partial<ToolCall>
): ChatMessage[] {
  return messages.map((m) => {
    if (m.id !== messageId) return m;
    return { ...m, toolCalls: m.toolCalls.map((tc) => (tc.id === callId ? { ...tc, ...patch } : tc)) };
  });
}

function findMessage(s: AgentState, id: string): ChatMessage | undefined {
  return s.messages.find((m) => m.id === id);
}

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: [],
  status: "connecting",
  isStreaming: false,
  pendingConfirmation: null,
  socket: null,
  conversationId: null,
  conversations: [],
  suggestions: [],
  lastSimulation: null,
  mode: "chat",
  setMode: (mode) => set({ mode }),

  connect: () => {
    const existing = get().socket;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    const ws = new WebSocket(agentWsUrl());
    seededConversations.clear();
    set({ status: "connecting" });

    ws.onopen = () => {
      reconnectAttempt = 0;
      set({ status: "open" });
    };
    ws.onclose = () => {
      // A turn that was mid-flight on the dead socket will never get its "done"/"error"
      // event now — clear it so the UI (and the send button) doesn't look frozen.
      set({ status: "closed", socket: null, isStreaming: false, pendingConfirmation: null });
      scheduleReconnect(() => get().connect());
    };
    ws.onerror = () => set({ status: "error" });
    ws.onmessage = (event) => handleServerEvent(JSON.parse(event.data), set, get);

    set({ socket: ws });
  },

  initConversations: () => {
    const existing = listConversations();
    set({ conversations: existing });
    if (existing.length > 0) {
      get().switchConversation(existing[0].id);
    } else {
      get().newConversation();
    }
  },

  refreshConversations: () => {
    set({ conversations: listConversations() });
  },

  newConversation: () => {
    const id = uid();
    createConversation(id, "New chat");
    activeAssistantId = null;
    set({ conversationId: id, messages: [], conversations: listConversations() });
  },

  switchConversation: (id: string) => {
    const rows = listChatMessages(id);
    const messages: ChatMessage[] = rows.map((r) => ({
      id: r.id,
      role: r.role,
      text: r.text,
      toolCalls: [],
    }));
    activeAssistantId = null;
    set({ conversationId: id, messages });
  },

  removeConversation: (id: string) => {
    deleteConversation(id);
    const remaining = listConversations();
    set({ conversations: remaining });
    if (get().conversationId === id) {
      if (remaining.length > 0) {
        get().switchConversation(remaining[0].id);
      } else {
        get().newConversation();
      }
    }
  },

  sendMessage: (text: string, opts?: { regenerate?: boolean; image?: string }) => {
    const ws = get().socket;
    if (!ws || ws.readyState !== WebSocket.OPEN || get().isStreaming) return;
    const regenerate = !!opts?.regenerate;
    const image = opts?.image;

    let conversationId = get().conversationId;
    if (!conversationId) {
      conversationId = uid();
      createConversation(conversationId, titleFromText(text));
      set({ conversationId });
    }

    const existing = get().messages;
    if (existing.length === 0) {
      touchConversation(conversationId, titleFromText(text));
    } else {
      touchConversation(conversationId);
    }

    // Context for a conversation the server hasn't seen on this connection yet.
    let seed: Array<{ role: "user" | "assistant"; text: string }> | undefined;
    if (!seededConversations.has(conversationId)) {
      const prior = regenerate ? existing.slice(0, -1) : existing;
      seed = prior
        .filter((m) => m.text.trim())
        .slice(-14)
        .map((m) => ({ role: m.role, text: m.text }));
      seededConversations.add(conversationId);
    }

    const assistantMessage: ChatMessage = { id: uid(), role: "assistant", text: "", toolCalls: [], streaming: true };
    activeAssistantId = assistantMessage.id;

    if (regenerate) {
      set((s) => ({ messages: [...s.messages, assistantMessage], isStreaming: true, suggestions: [] }));
    } else {
      // The image attachment is session-only (not persisted to SQLite) — it's
      // re-sent to the model for this turn but doesn't bloat local storage or
      // get reloaded when the conversation is reopened later.
      const userMessage: ChatMessage = { id: uid(), role: "user", text, toolCalls: [], image };
      saveChatMessage(userMessage.id, conversationId, "user", text);
      set((s) => ({
        messages: [...s.messages, userMessage, assistantMessage],
        isStreaming: true,
        suggestions: [],
        conversations: listConversations(),
      }));
    }

    const payload: ClientMessage = {
      type: "user_message",
      text,
      clientDate: `${localIsoNow()} ${localWeekday()}`,
      upcoming: upcomingDays(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      conversationId,
      seed,
      profile: loadProfile(),
      commitments: listCommitments("open"),
      regenerate,
      mode: get().mode,
      image,
    };
    recordOutbound({
      kind: "agent_turn",
      destination: agentWsUrl(),
      purpose: "Your message and recent context, sent to the model",
      // The ledger shows what was sent without bloating itself with a full base64 image.
      payload: image ? { ...payload, image: `[image attached, ${Math.round(image.length / 1024)}KB]` } : payload,
    });
    ws.send(JSON.stringify(payload));
  },

  stopGeneration: () => {
    const ws = get().socket;
    if (!get().isStreaming || !ws || ws.readyState !== WebSocket.OPEN) return;
    // A confirmation sheet may be open for this turn: close it as declined.
    const pending = get().pendingConfirmation;
    if (pending) {
      set((s) => ({
        pendingConfirmation: null,
        messages: updateToolCall(s.messages, pending.messageId, pending.callId, { status: "declined" }),
      }));
    }
    ws.send(JSON.stringify({ type: "cancel" } satisfies ClientMessage));
  },

  regenerateLast: () => {
    const { messages, isStreaming, conversationId } = get();
    if (isStreaming || !conversationId) return;
    let lastAssistant = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        lastAssistant = i;
        break;
      }
    }
    const userMsg = lastAssistant > 0 ? messages[lastAssistant - 1] : undefined;
    if (lastAssistant < 0 || !userMsg || userMsg.role !== "user") return;
    deleteChatMessage(messages[lastAssistant].id);
    set({ messages: messages.slice(0, lastAssistant) });
    get().sendMessage(userMsg.text, { regenerate: true });
  },

  confirmPending: (approve: boolean) => {
    const pending = get().pendingConfirmation;
    if (!pending) return;
    set({ pendingConfirmation: null });
    void resolveToolCall(pending, approve, set, get);
  },

  runSimulation: async (args) => {
    const result = await simulatePlan(args);
    set({ lastSimulation: result });
  },
}));

function handleServerEvent(
  event: ServerEvent,
  set: SetFn,
  get: () => AgentState
) {
  switch (event.type) {
    case "connected":
      return;

    case "delta": {
      const id = activeAssistantId;
      if (!id) return;
      set((s) => {
        const msg = findMessage(s, id);
        if (!msg) return {};
        return { messages: updateMessage(s.messages, id, { text: msg.text + event.text }) };
      });
      return;
    }

    case "tool_call_start": {
      const id = activeAssistantId;
      if (!id) return;
      const call: ToolCall = {
        id: event.id,
        name: event.name,
        args: event.args,
        status: event.requiresConfirmation ? "awaiting_confirmation" : "running",
      };
      set((s) => ({
        messages: s.messages.map((m) => (m.id === id ? { ...m, toolCalls: [...m.toolCalls, call] } : m)),
      }));

      if (event.requiresConfirmation) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        set(() => ({
          pendingConfirmation: { messageId: id, callId: event.id, name: event.name, args: event.args },
        }));
      } else {
        void runTool(id, event.id, event.name, event.args, set, get);
      }
      return;
    }

    case "suggestions":
      if (!get().isStreaming) set({ suggestions: event.items });
      return;

    case "tool_call_result":
      // Server's echo of the result — the client already applied it optimistically
      // when it executed the tool locally. Reserved for future audit/logging.
      return;

    case "done": {
      const id = activeAssistantId;
      if (id) {
        const current = findMessage(get(), id);
        // Stopped before anything was written: leave a visible note instead of an empty reply.
        const text = current && !current.text.trim() ? "Stopped." : current?.text ?? "";
        set((s) => ({ messages: updateMessage(s.messages, id, { streaming: false, text }) }));
        saveChatMessage(id, get().conversationId!, "assistant", text);
      }
      activeAssistantId = null;
      set({ isStreaming: false });
      if (!cloudMinimised()) scheduleProfileRefresh();
      return;
    }

    case "error": {
      const id = activeAssistantId;
      if (id) {
        set((s) => {
          const msg = findMessage(s, id);
          return {
            messages: updateMessage(s.messages, id, {
              text: (msg?.text ?? "") + `\n\n⚠️ ${event.message}`,
              streaming: false,
            }),
          };
        });
        const finalText = findMessage(get(), id)?.text ?? "";
        const conversationId = get().conversationId;
        if (conversationId) saveChatMessage(id, conversationId, "assistant", finalText);
      }
      activeAssistantId = null;
      set({ isStreaming: false });
      return;
    }
  }
}

async function runTool(
  messageId: string,
  callId: string,
  name: string,
  args: Record<string, any>,
  set: SetFn,
  get: () => AgentState
) {
  try {
    const result = await executeTool(name as ToolName, args);
    set((s) => ({ messages: updateToolCall(s.messages, messageId, callId, { status: "done", result }) }));
    if (name === "simulate_plan" && result && typeof result === "object") {
      set({ lastSimulation: result as SimulationResult });
    }
    sendToolResult(get, callId, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    set((s) => ({ messages: updateToolCall(s.messages, messageId, callId, { status: "error", error: message }) }));
    sendToolResult(get, callId, { error: message });
  }
}

async function resolveToolCall(
  pending: PendingConfirmation,
  approve: boolean,
  set: SetFn,
  get: () => AgentState
) {
  if (!approve) {
    set((s) => ({
      messages: updateToolCall(s.messages, pending.messageId, pending.callId, { status: "declined" }),
    }));
    sendToolResult(get, pending.callId, { error: "User declined this action." });
    return;
  }

  set((s) => ({ messages: updateToolCall(s.messages, pending.messageId, pending.callId, { status: "running" }) }));
  await runTool(pending.messageId, pending.callId, pending.name, pending.args, set, get);
}

function sendToolResult(get: () => AgentState, callId: string, result: unknown) {
  const ws = get().socket;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const payload: ClientMessage = { type: "tool_result", callId, result };
  recordOutbound({
    kind: "tool_result",
    destination: agentWsUrl(),
    purpose: "The result of a device action, sent back to the model",
    payload,
  });
  ws.send(JSON.stringify(payload));
}
