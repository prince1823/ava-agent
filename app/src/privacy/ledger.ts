// Privacy ledger: a local record of every outbound request Ava makes, so the user
// can see what left the device, when, and how much. Only metadata is stored here —
// never the payload itself.

import { getSetting, setSetting } from "../db/db";

export type OutboundKind = "agent_turn" | "tool_result" | "memory_extract";

export interface LedgerEntry {
  at: string;
  kind: OutboundKind;
  destination: string;
  purpose: string;
  bytes: number;
}

const LEDGER_KEY = "privacy_ledger";
const CLOUD_MINIMISED_KEY = "cloud_minimised";
const MAX_ENTRIES = 100;

export function recordOutbound(entry: { kind: OutboundKind; destination: string; purpose: string; payload: unknown }) {
  let bytes = 0;
  try {
    bytes = JSON.stringify(entry.payload ?? null)?.length ?? 0;
  } catch {
    bytes = 0;
  }
  const rows = listOutbound();
  rows.unshift({
    at: new Date().toISOString(),
    kind: entry.kind,
    destination: entry.destination,
    purpose: entry.purpose,
    bytes,
  });
  setSetting(LEDGER_KEY, JSON.stringify(rows.slice(0, MAX_ENTRIES)));
}

export function listOutbound(): LedgerEntry[] {
  const raw = getSetting(LEDGER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LedgerEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearOutbound() {
  setSetting(LEDGER_KEY, "[]");
}

/** When on, Ava skips optional cloud work (memory extraction, follow-up suggestions). */
export function cloudMinimised(): boolean {
  return getSetting(CLOUD_MINIMISED_KEY) === "true";
}

export function setCloudMinimised(value: boolean) {
  setSetting(CLOUD_MINIMISED_KEY, value ? "true" : "false");
}

export function ledgerSummary(): { count: number; bytes: number; last: string | null } {
  const rows = listOutbound();
  return {
    count: rows.length,
    bytes: rows.reduce((n, r) => n + r.bytes, 0),
    last: rows[0]?.at ?? null,
  };
}