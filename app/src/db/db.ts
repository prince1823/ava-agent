import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("ava.db");

export function initDb() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS action_log (
      id INTEGER PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reversed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS commitments (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      person TEXT,
      due_at TEXT,
      status TEXT NOT NULL,
      source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
  `);

  migrateActionLogReversedColumn();

  const count = db.getFirstSync<{ c: number }>("SELECT COUNT(*) as c FROM expenses");
  if (count?.c === 0) {
    seedExpenses();
  }
}

function migrateActionLogReversedColumn() {
  const cols = db.getAllSync<{ name: string }>("PRAGMA table_info(action_log)");
  if (!cols.some((c) => c.name === "reversed")) {
    db.execSync("ALTER TABLE action_log ADD COLUMN reversed INTEGER NOT NULL DEFAULT 0");
  }
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
    const createdAt = new Date(now - s.daysAgo * 86400000).toISOString();
    db.runSync(
      "INSERT INTO expenses (amount, category, note, created_at) VALUES (?, ?, ?, ?)",
      s.amount,
      s.category,
      s.note,
      createdAt
    );
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
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (opts.category) {
    clauses.push("category = ?");
    params.push(opts.category);
  }
  if (opts.since) {
    clauses.push("created_at >= ?");
    params.push(opts.since);
  }
  if (opts.until) {
    clauses.push("created_at <= ?");
    params.push(opts.until);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.getAllSync<ExpenseRow>(
    `SELECT * FROM expenses ${where} ORDER BY created_at DESC`,
    ...params
  );
}

export function addExpense(amount: number, category: string, note?: string): ExpenseRow {
  const createdAt = new Date().toISOString();
  const result = db.runSync(
    "INSERT INTO expenses (amount, category, note, created_at) VALUES (?, ?, ?, ?)",
    amount,
    category,
    note ?? "",
    createdAt
  );
  return { id: result.lastInsertRowId, amount, category, note: note ?? null, created_at: createdAt };
}

export function rememberFact(key: string, value: string) {
  const updatedAt = new Date().toISOString();
  db.runSync(
    `INSERT INTO memory (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    updatedAt
  );
}

export function recallFacts(key?: string): Array<{ key: string; value: string }> {
  if (key) {
    const row = db.getFirstSync<{ key: string; value: string }>(
      "SELECT key, value FROM memory WHERE key = ?",
      key
    );
    return row ? [row] : [];
  }
  return db.getAllSync<{ key: string; value: string }>("SELECT key, value FROM memory ORDER BY updated_at DESC");
}

export function getSpendingInsight(): string | null {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

  const today = db.getFirstSync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE created_at >= ?",
    todayStart.toISOString()
  );
  const priorWeek = db.getFirstSync<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE created_at >= ? AND created_at < ?",
    weekStart.toISOString(),
    todayStart.toISOString()
  );

  const todayTotal = today?.total ?? 0;
  const dailyAvg = (priorWeek?.total ?? 0) / 7;

  if (todayTotal > 0 && dailyAvg > 0 && todayTotal > dailyAvg * 1.5) {
    const pct = Math.round((todayTotal / dailyAvg - 1) * 100);
    return `You've spent $${todayTotal.toFixed(2)} today — about ${pct}% above your recent daily average.`;
  }
  return null;
}

export function deleteExpense(id: number) {
  db.runSync("DELETE FROM expenses WHERE id = ?", id);
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
  db.runSync(
    "INSERT INTO action_log (type, ref_id, description, created_at, reversed) VALUES (?, ?, ?, ?, 0)",
    type,
    refId,
    description,
    new Date().toISOString()
  );
}

export function getLastAction(): ActionLogRow | null {
  return db.getFirstSync<ActionLogRow>(
    "SELECT * FROM action_log WHERE reversed = 0 ORDER BY id DESC LIMIT 1"
  );
}

export function markActionReversed(id: number) {
  db.runSync("UPDATE action_log SET reversed = 1 WHERE id = ?", id);
}

export function listActionLog(limit = 50): ActionLogRow[] {
  return db.getAllSync<ActionLogRow>("SELECT * FROM action_log ORDER BY id DESC LIMIT ?", limit);
}

export async function undoActionById(id: number, reverse: (row: ActionLogRow) => Promise<void>) {
  const row = db.getFirstSync<ActionLogRow>("SELECT * FROM action_log WHERE id = ?", id);
  if (!row || row.reversed) return;
  await reverse(row);
  markActionReversed(id);
}

// --- Conversations & persisted chat history ---

export interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function createConversation(id: string, title: string) {
  const now = new Date().toISOString();
  db.runSync(
    "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    id,
    title,
    now,
    now
  );
}

export function touchConversation(id: string, title?: string) {
  const now = new Date().toISOString();
  if (title) {
    db.runSync("UPDATE conversations SET updated_at = ?, title = ? WHERE id = ?", now, title, id);
  } else {
    db.runSync("UPDATE conversations SET updated_at = ? WHERE id = ?", now, id);
  }
}

export function listConversations(): ConversationRow[] {
  return db.getAllSync<ConversationRow>("SELECT * FROM conversations ORDER BY updated_at DESC");
}

export function clearAllConversations() {
  db.execSync("DELETE FROM chat_messages; DELETE FROM conversations;");
}

export function deleteConversation(id: string) {
  db.runSync("DELETE FROM chat_messages WHERE conversation_id = ?", id);
  db.runSync("DELETE FROM conversations WHERE id = ?", id);
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
}

export function saveChatMessage(id: string, conversationId: string, role: "user" | "assistant", text: string) {
  db.runSync(
    "INSERT OR REPLACE INTO chat_messages (id, conversation_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)",
    id,
    conversationId,
    role,
    text,
    new Date().toISOString()
  );
}

export function updateChatMessageText(id: string, text: string) {
  db.runSync("UPDATE chat_messages SET text = ? WHERE id = ?", text, id);
}

export function listChatMessages(conversationId: string): ChatMessageRow[] {
  return db.getAllSync<ChatMessageRow>(
    "SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC",
    conversationId
  );
}

// --- Settings ---

export function getSetting(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.runSync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value
  );
}

// --- Memory profile inputs ---

export interface ProfileMessageRow {
  role: "user" | "assistant";
  text: string;
  created_at: string;
}

export function listMessagesForProfile(afterIso: string | null, limit = 800): ProfileMessageRow[] {
  const rows = afterIso
    ? db.getAllSync<ProfileMessageRow>(
        "SELECT role, text, created_at FROM chat_messages WHERE created_at > ? ORDER BY created_at DESC LIMIT ?",
        afterIso,
        limit
      )
    : db.getAllSync<ProfileMessageRow>(
        "SELECT role, text, created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?",
        limit
      );
  return rows.reverse();
}

export function countChatMessages(): number {
  return db.getFirstSync<{ c: number }>("SELECT COUNT(*) as c FROM chat_messages")?.c ?? 0;
}

export function deleteChatMessage(id: string) {
  db.runSync("DELETE FROM chat_messages WHERE id = ?", id);
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

export function createCommitment(input: {
  title: string;
  detail?: string;
  person?: string;
  dueAt?: string;
  source?: string;
}): CommitmentRow {
  const now = new Date().toISOString();
  const id = `cm-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  db.runSync(
    `INSERT INTO commitments (id, title, detail, person, due_at, status, source, created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, NULL)`,
    id,
    input.title,
    input.detail ?? null,
    input.person ?? null,
    input.dueAt ?? null,
    input.source ?? null,
    now,
    now
  );
  return {
    id,
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
}

export function listCommitments(status: CommitmentStatus | "all" = "open"): CommitmentRow[] {
  const rows =
    status === "all"
      ? db.getAllSync<CommitmentRow>("SELECT * FROM commitments ORDER BY COALESCE(due_at, created_at) ASC")
      : db.getAllSync<CommitmentRow>(
          "SELECT * FROM commitments WHERE status = ? ORDER BY COALESCE(due_at, created_at) ASC",
          status
        );
  return rows;
}

export function getCommitment(id: string): CommitmentRow | null {
  return db.getFirstSync<CommitmentRow>("SELECT * FROM commitments WHERE id = ?", id);
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
  const now = new Date().toISOString();
  db.runSync(
    "UPDATE commitments SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?",
    status,
    now,
    status === "done" ? now : null,
    id
  );
  return getCommitment(id);
}

export function updateCommitment(
  id: string,
  patch: { title?: string; detail?: string; person?: string; dueAt?: string | null }
): CommitmentRow | null {
  const existing = getCommitment(id);
  if (!existing) return null;
  db.runSync(
    `UPDATE commitments SET title = ?, detail = ?, person = ?, due_at = ?, updated_at = ? WHERE id = ?`,
    patch.title ?? existing.title,
    patch.detail ?? existing.detail,
    patch.person ?? existing.person,
    patch.dueAt === undefined ? existing.due_at : patch.dueAt,
    new Date().toISOString(),
    id
  );
  return getCommitment(id);
}

export function deleteCommitment(id: string) {
  db.runSync("DELETE FROM commitments WHERE id = ?", id);
}
