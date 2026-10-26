// Web notifications cannot be scheduled ahead of time by expo-notifications, and
// browsers only allow immediate notifications with a granted permission. Reminders
// are therefore recorded and surfaced in the activity log as simulated.

const KEY = "ava.web.reminders";

interface WebReminder {
  id: string;
  title: string;
  body: string;
  fireAt: string;
}

function load(): WebReminder[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as WebReminder[];
  } catch {
    return [];
  }
}

function save(rows: WebReminder[]) {
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(rows));
}

async function notifyNow(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  try {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    /* notification failed; reminder is still recorded */
  }
}

export async function ensureNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    await Notification.requestPermission().catch(() => {});
  }
}

export async function scheduleReminder(args: { title: string; body: string; fireAt: string }) {
  const id = `web-rem-${Date.now().toString(36)}`;
  const rows = load();
  rows.push({ id, title: args.title, body: args.body, fireAt: args.fireAt });
  save(rows);

  // A reminder due within the next minute can be shown immediately; anything later
  // is recorded only, because the browser cannot fire it while closed.
  const due = new Date(args.fireAt).getTime() - Date.now();
  if (due <= 60_000) await notifyNow(args.title, args.body);

  return { id, title: args.title, fireAt: args.fireAt, simulated: true };
}

export async function cancelReminder(identifier: string) {
  save(load().filter((r) => r.id !== identifier));
}

/** Read-only view of recorded reminders, used by the simulator's dry-run. */
export async function listReminders() {
  return load().map((r) => ({ ...r, fireAt: r.fireAt, daily: r.fireAt.includes("daily") }));
}

export async function scheduleDailyCheckin(args: { hour: number; minute: number }) {
  const id = "web-daily-checkin";
  const rows = load().filter((r) => r.id !== id);
  rows.push({
    id,
    title: "Good morning",
    body: "Open Ava for your calendar and spending summary.",
    fireAt: `${String(args.hour).padStart(2, "0")}:${String(args.minute).padStart(2, "0")} daily`,
  });
  save(rows);
  return { id, hour: args.hour, minute: args.minute, simulated: true };
}