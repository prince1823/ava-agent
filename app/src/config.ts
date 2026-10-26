import { getSetting } from "./db/db";

export function agentWsUrl(): string {
  return getSetting("ws_url") || process.env.EXPO_PUBLIC_AGENT_WS_URL || "ws://localhost:8787/agent";
}

// Same host as the agent socket, over http(s): ws://host:8787/agent -> http://host:8787
export function agentHttpBase(): string {
  return agentWsUrl()
    .replace(/^wss:/, "https:")
    .replace(/^ws:/, "http:")
    .replace(/\/agent\/?$/, "");
}
