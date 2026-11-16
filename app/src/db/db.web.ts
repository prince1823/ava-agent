// Web implementation of the local store. The native build keeps db.ts (SQLite);
// Metro resolves this file for the web bundle so nothing native is imported there.
// Data lives in localStorage, shaped as the same rows the native queries return.

const PREFIX = "ava.db.";

type Store = {
  expenses: ExpenseRow[];
  memory: Array<{ key: string; value: string; updated_at: string }>;
  actionLog: ActionLogRow[];
  conversations: ConversationRow[];
  chatMessages: ChatMessageRow[];
  settings: Record<string, string>;
};

// Static export / SSR has no localStorage; fall back to an in-memory object.
const memoryFallback: Record<string, string> = {};
function storage(): Pick<Storage, "getItem" | "setItem"> {
  if (typeof localStorage !== "undefined") return localStorage;
  return {
    getItem: (k: string) => (k in memoryFallback ? memoryFallback[k] : null),
    setItem: (k: string, v: string) => {
      memoryFallback[k] = v;
    },
  };
}

function read<T>(key: string, fallback: T): T {
  const raw = storage().getItem(PREFIX + key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  storage().setItem(PREFIX + key, JSON.stringify(value));
}

let nextExpenseId = 1;
let nextActionId = 1;

export function initDb() {
  if (storage().getItem(PREFIX + "initialised")) {
    nextExpenseId = read<ExpenseRow[]>("expenses", []).reduce((n, r) => Math.max(n, r.id + 1), 1);
    nextActionId = read<ActionLogRow[]>("actionLog", []).reduce((n, r) => Math.max(n, r.id + 1), 1);
    return;
  }
  storage().setItem(PREFIX + "initialised", "1");
  write("expenses", []);
  write("memory", []);
  write("actionLog", []);
  write("conversations", []);
  write("chatMessages", []);
  write("settings", {});
  seedExpenses();
}

function seedExpenses() {
  const seed: Array<{ amount: number; category: string; note: string; daysAgo: number }> = [
    { amount: 12.5, category: "food", note: "Coffee + lunch", daysAgo: 1 },
    { amount: 48.0, category: "food", note: "Groceries", daysAgo: 2 },
    { amount: 15.0, category: "transport", note: "Cab ride", daysAgo: 2 },
    { amount: 9.99, category: "subscription", note: "Streaming service", daysAgo: 4 },
    { amount: 65.0, category: "food", note: "Dinner with friends", daysAgo: 5 },
    { amount: 22.0, category: "transport", note: "Fuel", daysAgo: 6 },
  ];
  const now = Date.now();
  for (const s of seed) {
    addExpenseInternal(s.amount, s.category, s.note, new Date(now - s.daysAgo * 86400000).toISOString());
  }
}

export interface ExpenseRow {
  id: number;
  amount: number;
  category: string;
  note: string | null;
  created_at: string;
}

export function queryExpenses(opts: { category?: string; since?: string; until?: string }): ExpenseRow[] {
  return read<ExpenseRow[]>("expenses", [])
    .filter((r) => {
      if (opts.category && r.category !== opts.category) return false;
      if (opts.since && r.created_at < opts.since) return false;
      if (opts.until && r.created_at > opts.until) return false;
      return true;
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function addExpenseInternal(amount: number, category: string, note: string, createdAt: string): ExpenseRow {
  const rows = read<ExpenseRow[]>("expenses", []);
  const row: ExpenseRow = {
    id: nextExpenseId++,
    amount,
    category,
    note: note || null,
    created_at: createdAt,
  };
  rows.push(row);
  write("expenses", rows);
  return row;
}

export function addExpense(amount: number, category: string, note?: string): ExpenseRow {
  return addExpenseInternal(amount, category, note ?? "", new Date().toISOString());
}

export function rememberFact(key: string, value: string) {
  const rows = read<Store["memory"]>("memory", []);
  const existing = rows.find((r) => r.key === key);
  const updatedAt = new Date().toISOString();
  if (existing) {
    existing.value = value;
    existing.updated_at = updatedAt;
  } else {
    rows.push({ key, value, updated_at: updatedAt });
  }
  write("memory", rows);
}

export function recallFacts(key?: string): Array<{ key: string; value: string }> {
  const rows = read<Store["memory"]>("memory", []).slice().sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  const filtered = key ? rows.filter((r) => r.key === key) : rows;
  return filtered.map((r) => ({ key: r.key, value: r.value }));
}

export function getSpendingInsight(): string | null {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
  const rows = read<ExpenseRow[]>("expenses", []);

  const todayTotal = rows
    .filter((r) => new Date(r.created_at) >= todayStart)
    .reduce((n, r) => n + r.amount, 0);
  const priorWeek = rows
    .filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= weekStart.getTime() && t < todayStart.getTime();
    })
    .reduce((n, r) => n + r.amount, 0);

  const dailyAvg = priorWeek / 7;
  if (todayTotal > 0 && dailyAvg > 0 && todayTotal > dailyAvg * 1.5) {
    const pct = Math.round((todayTotal / dailyAvg - 1) * 100);
    return `You've spent $${todayTotal.toFixed(2)} today — about ${pct}% above your recent daily average.`;
  }
  return null;
}

export function deleteExpense(id: number) {
  write(
    "expenses",
    read<ExpenseRow[]>("expenses", []).filter((r) => r.id !== id)
  );
}

export type UndoableActionType = "calendar_event" | "reminder" | "expense";

export interface ActionLogRow {
  id: number;
  type: UndoableActionType;
  ref_id: string;
  description: string;
  created_at: string;
  reversed: number;
}

export function logAction(type: UndoableActionType, refId: string, description: string) {
  const rows = read<ActionLogRow[]>("actionLog", []);
  rows.push({
    id: nextActionId++,
    type,
    ref_id: refId,
    description,
    created_at: new Date().toISOString(),
    reversed: 0,
  });
  write("actionLog", rows);
}

export function getLastAction(): ActionLogRow | null {
  const rows = read<ActionLogRow[]>("actionLog", [])
    .filter((r) => !r.reversed)
    .sort((a, b) => b.id - a.id);
  return rows[0] ?? null;
}

export function markActionReversed(id: number) {
  const rows = read<ActionLogRow[]>("actionLog", []);
  const row = rows.find((r) => r.id === id);
  if (row) row.reversed = 1;
  write("actionLog", rows);
}

export function listActionLog(limit = 50): ActionLogRow[] {
  return read<ActionLogRow[]>("actionLog", [])
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);
}

export async function undoActionById(id: number, reverse: (row: ActionLogRow) => Promise<void>) {
  const row = read<ActionLogRow[]>("actionLog", []).find((r) => r.id === id);
  if (!row || row.reversed) return;
  await reverse(row);
  markActionReversed(id);
}

export interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function createConversation(id: string, title: string) {
  const rows = read<ConversationRow[]>("conversations", []);
  const now = new Date().toISOString();
  rows.push({ id, title, created_at: now, updated_at: now });
  write("conversations", rows);
}

export function touchConversation(id: string, title?: string) {
  const rows = read<ConversationRow[]>("conversations", []);
  const row = rows.find((r) => r.id === id);
  if (!row) return;
  row.updated_at = new Date().toISOString();
  if (title) row.title = title;
  write("conversations", rows);
}

export function listConversations(): ConversationRow[] {
  return read<ConversationRow[]>("conversations", []).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export function clearAllConversations() {
  write("chatMessages", []);
  write("conversations", []);
}

export function deleteConversation(id: string) {
  write(
    "conversations",
    read<ConversationRow[]>("conversations", []).filter((r) => r.id !== id)
  );
  write(
    "chatMessages",
    read<ChatMessageRow[]>("chatMessages", []).filter((r) => r.conversation_id !== id)
  );
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
  image: string | null;
}

export function saveChatMessage(
  id: string,
  conversationId: string,
  role: "user" | "assistant",
  text: string,
  image?: string | null
) {
  const rows = read<ChatMessageRow[]>("chatMessages", []);
  const existing = rows.find((r) => r.id === id);
  if (existing) {
    existing.text = text;
    existing.role = role;
    if (image !== undefined) existing.image = image ?? null;
  } else {
    rows.push({
      id,
      conversation_id: conversationId,
      role,
      text,
      created_at: new Date().toISOString(),
      image: image ?? null,
    });
  }
  write("chatMessages", rows);
}

export function updateChatMessageText(id: string, text: string) {
  const rows = read<ChatMessageRow[]>("chatMessages", []);
  const row = rows.find((r) => r.id === id);
  if (row) row.text = text;
  write("chatMessages", rows);
}

export function listChatMessages(conversationId: string): ChatMessageRow[] {
  return read<ChatMessageRow[]>("chatMessages", [])
    .filter((r) => r.conversation_id === conversationId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export function getSetting(key: string): string | null {
  return read<Store["settings"]>("settings", {})[key] ?? null;
}

export function setSetting(key: string, value: string) {
  const settings = read<Store["settings"]>("settings", {});
  settings[key] = value;
  write("settings", settings);
}

export interface ProfileMessageRow {
  role: "user" | "assistant";
  text: string;
  created_at: string;
}

export function listMessagesForProfile(afterIso: string | null, limit = 800): ProfileMessageRow[] {
  const rows = read<ChatMessageRow[]>("chatMessages", []).map((r) => ({
    role: r.role,
    text: r.text,
    created_at: r.created_at,
  }));
  const filtered = afterIso ? rows.filter((r) => r.created_at > afterIso) : rows;
  return filtered
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit)
    .reverse();
}

export function countChatMessages(): number {
  return read<ChatMessageRow[]>("chatMessages", []).length;
}

export function deleteChatMessage(id: string) {
  write(
    "chatMessages",
    read<ChatMessageRow[]>("chatMessages", []).filter((r) => r.id !== id)
  );
}

// --- Commitments: promises and intentions Ava tracks for the user ---

export type CommitmentStatus = "open" | "done" | "dropped";

export interface CommitmentRow {
  id: string;
  title: string;
  detail: string | null;
  person: string | null;
  due_at: string | null;
  status: CommitmentStatus;
  source: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function loadCommitments(): CommitmentRow[] {
  return read<CommitmentRow[]>("commitments", []);
}

function saveCommitments(rows: CommitmentRow[]) {
  write("commitments", rows);
}

export function createCommitment(input: {
  title: string;
  detail?: string;
  person?: string;
  dueAt?: string;
  source?: string;
}): CommitmentRow {
  const now = new Date().toISOString();
  const row: CommitmentRow = {
    id: `cm-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    title: input.title,
    detail: input.detail ?? null,
    person: input.person ?? null,
    due_at: input.dueAt ?? null,
    status: "open",
    source: input.source ?? null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };
  saveCommitments([...loadCommitments(), row]);
  return row;
}

export function listCommitments(status: CommitmentStatus | "all" = "open"): CommitmentRow[] {
  const rows = status === "all" ? loadCommitments() : loadCommitments().filter((r) => r.status === status);
  const key = (r: CommitmentRow) => r.due_at ?? r.created_at;
  return rows.slice().sort((a, b) => (key(a) < key(b) ? -1 : 1));
}

export function getCommitment(id: string): CommitmentRow | null {
  return loadCommitments().find((r) => r.id === id) ?? null;
}

/** Resolve by exact id, or by the best case-insensitive title/person match. */
export function findCommitment(idOrText: string): CommitmentRow | null {
  const byId = getCommitment(idOrText);
  if (byId) return byId;
  const needle = idOrText.trim().toLowerCase();
  if (!needle) return null;
  const open = listCommitments("open");
  return (
    open.find((c) => c.title.toLowerCase() === needle) ??
    open.find((c) => c.title.toLowerCase().includes(needle)) ??
    open.find((c) => (c.person ?? "").toLowerCase() === needle) ??
    open.find((c) => (c.person ?? "").toLowerCase().includes(needle)) ??
    null
  );
}

export function setCommitmentStatus(id: string, status: CommitmentStatus): CommitmentRow | null {
  const rows = loadCommitments();
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  row.status = status;
  row.updated_at = new Date().toISOString();
  row.completed_at = status === "done" ? row.updated_at : null;
  saveCommitments(rows);
  return row;
}

export function updateCommitment(
  id: string,
  patch: { title?: string; detail?: string; person?: string; dueAt?: string | null }
): CommitmentRow | null {
  const rows = loadCommitments();
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.detail !== undefined) row.detail = patch.detail;
  if (patch.person !== undefined) row.person = patch.person;
  if (patch.dueAt !== undefined) row.due_at = patch.dueAt;
  row.updated_at = new Date().toISOString();
  saveCommitments(rows);
  return row;
}

export function deleteCommitment(id: string) {
  saveCommitments(loadCommitments().filter((r) => r.id !== id));
}