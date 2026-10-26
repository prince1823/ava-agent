export type ServerEvent =
  | { type: "connected" }
  | { type: "delta"; text: string }
  | { type: "tool_call_start"; id: string; name: string; args: Record<string, any>; requiresConfirmation: boolean }
  | { type: "tool_call_result"; id: string; name: string; result: unknown }
  | { type: "suggestions"; items: string[] }
  | { type: "done" }
  | { type: "error"; message: string };

export type ClientMessage =
  | {
      type: "user_message";
      text: string;
      clientDate: string;
      timeZone: string;
      upcoming?: string;
      conversationId: string;
      seed?: Array<{ role: "user" | "assistant"; text: string }>;
      profile?: unknown;
      commitments?: unknown;
      regenerate?: boolean;
    }
  | { type: "cancel" }
  | { type: "tool_result"; callId: string; result: unknown };

export type ToolCardStatus = "running" | "awaiting_confirmation" | "done" | "declined" | "error";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  status: ToolCardStatus;
  result?: unknown;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls: ToolCall[];
  streaming?: boolean;
}
