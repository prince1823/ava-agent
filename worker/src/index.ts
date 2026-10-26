import { getAgentByName } from "agents";
import { extractProfile, type MemoryMessage } from "./memory";
import { AvaAgent } from "./AvaAgent";

export { AvaAgent };

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  return new Response(res.body, { status: res.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    if (url.pathname === "/health") {
      return withCors(Response.json({ ok: true, model: env.AGENT_MODEL ?? "openai/gpt-4o-mini" }));
    }

    if (url.pathname === "/memory/extract" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => null)) as
          | { messages?: unknown; existing?: unknown; facts?: unknown }
          | null;
        if (!body || !Array.isArray(body.messages)) {
          return withCors(Response.json({ error: "messages must be an array" }, { status: 400 }));
        }
        const clean: MemoryMessage[] = body.messages
          .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
          .map((m: any) => ({ role: m.role, text: m.text, at: String(m.at ?? "") }));
        const profile = await extractProfile(
          clean,
          body.existing ?? null,
          Array.isArray(body.facts) ? body.facts : [],
          { apiKey: env.OPENROUTER_API_KEY, model: env.AGENT_MODEL || "openai/gpt-4o-mini" }
        );
        return withCors(Response.json({ profile }));
      } catch (err) {
        return withCors(
          Response.json({ error: err instanceof Error ? err.message : "Memory extraction failed" }, { status: 500 })
        );
      }
    }

    // Every WebSocket connection gets its own fresh Durable Object instance,
    // matching the original single-process server where conversation state
    // lived in the per-connection closure rather than being shared across
    // devices/users.
    if (url.pathname === "/agent") {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return withCors(new Response("Expected a WebSocket upgrade", { status: 426 }));
      }
      const agent = await getAgentByName(env.AVA_AGENT, crypto.randomUUID());
      return agent.fetch(request);
    }

    return withCors(new Response("Not found", { status: 404 }));
  },
};
