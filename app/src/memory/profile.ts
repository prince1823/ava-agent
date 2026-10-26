import { agentHttpBase } from "../config";
import { getSetting, listMessagesForProfile, recallFacts, setSetting } from "../db/db";
import { cloudMinimised, recordOutbound } from "../privacy/ledger";

export interface UserProfile {
  about: {
    name: string | null;
    location: string | null;
    occupation: string | null;
    education: string | null;
    languages: string[];
  };
  preferences: string[];
  dietary_and_health: string[];
  routines: string[];
  people: Array<{ name: string; relationship: string | null; note: string | null }>;
  interests: string[];
  goals: string[];
  recurring_requests: string[];
  communication_style: string | null;
  behavior_patterns: string[];
  updated_at: string;
}

const PROFILE_KEY = "memory_profile";
const CURSOR_KEY = "memory_cursor";

export function loadProfile(): UserProfile | null {
  const raw = getSetting(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile) {
  setSetting(PROFILE_KEY, JSON.stringify(profile));
}

export function resetProfile() {
  setSetting(PROFILE_KEY, "");
  setSetting(CURSOR_KEY, "");
}

export type RefreshResult =
  | { status: "updated"; profile: UserProfile; analyzed: number }
  | { status: "up_to_date"; profile: UserProfile | null }
  | { status: "no_chats" };

let inFlight: Promise<RefreshResult> | null = null;

/**
 * Sends chat messages written since the last run (or all of them when `rebuild`)
 * to the memory agent on the server, which returns the updated profile.
 */
export function refreshProfile(opts: { rebuild?: boolean } = {}): Promise<RefreshResult> {
  if (inFlight) return inFlight;
  inFlight = run(opts).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run({ rebuild }: { rebuild?: boolean }): Promise<RefreshResult> {
  const existing = rebuild ? null : loadProfile();
  const cursor = rebuild ? null : getSetting(CURSOR_KEY) || null;

  const rows = listMessagesForProfile(existing ? cursor : null);
  if (rows.length === 0) {
    return existing ? { status: "up_to_date", profile: existing } : { status: "no_chats" };
  }
  if (!rows.some((r) => r.role === "user")) {
    return { status: "up_to_date", profile: existing };
  }

  // Cloud-minimised mode keeps memory local: no extraction round trip.
  if (cloudMinimised()) {
    return { status: "up_to_date", profile: existing };
  }

  recordOutbound({
    kind: "memory_extract",
    destination: `${agentHttpBase()}/memory/extract`,
    purpose: "Build your memory profile from recent chats",
    payload: { messages: rows.length, existing, facts: recallFacts() },
  });

  const res = await fetch(`${agentHttpBase()}/memory/extract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: rows.map((r) => ({ role: r.role, text: r.text, at: r.created_at })),
      existing,
      facts: recallFacts(),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Memory agent failed (${res.status}) ${detail.slice(0, 120)}`);
  }
  const { profile } = (await res.json()) as { profile: UserProfile };

  saveProfile(profile);
  setSetting(CURSOR_KEY, rows[rows.length - 1].created_at);
  return { status: "updated", profile, analyzed: rows.length };
}

// Quietly refresh the profile a while after the user stops chatting.
let timer: ReturnType<typeof setTimeout> | null = null;
export function scheduleProfileRefresh(delayMs = 45_000) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    refreshProfile().catch(() => {});
  }, delayMs);
}
