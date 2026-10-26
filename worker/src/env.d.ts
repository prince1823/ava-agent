// `wrangler types` only knows about bindings/vars declared in wrangler.jsonc.
// Secrets (set via `wrangler secret put` / `.dev.vars`, never committed) are
// declared here so they merge into the generated global `Env` interface.
declare global {
  interface Env {
    OPENROUTER_API_KEY: string;
  }
}

export {};
