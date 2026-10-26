// Dry-run engine for "what if" questions. It reads real local data (calendar,
// expenses, reminders) but never writes anything: the result is a timeline plus a
// before/after impact diff the agent can describe or the Simulator screen can render.

import { queryExpenses } from "../db/db";
import { listCalendarEvents } from "./calendar";
import { listReminders } from "./reminders";

export interface SimulatedAction {
  tool: string;
  summary?: string;
  args: Record<string, any>;
  at?: string;
}

export type Impact = {
  label: string;
  before: string;
  after: string;
  delta: string;
  tone: "up" | "down" | "flat";
};

export type TimelineEntry = {
  at: string;
  title: string;
  kind: "event" | "reminder" | "expense" | "message" | "note";
  detail?: string;
  simulated?: boolean;
};

export interface SimulationResult {
  horizon: "day" | "week";
  start: string;
  end: string;
  timeline: TimelineEntry[];
  impacts: Impact[];
  conflicts: string[];
  irreversible: string[];
  summary: string;
  simulated: true;
}

const HORIZON_DAYS: Record<"day" | "week", number> = { day: 1, week: 7 };

function asDate(value: unknown, fallback: Date): Date {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function hours(ms: number): number {
  return ms / 3_600_000;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function simulatePlan(args: {
  actions?: SimulatedAction[];
  horizon?: "day" | "week";
  start?: string;
}): Promise<SimulationResult> {
  const horizon: "day" | "week" = args.horizon === "week" ? "week" : "day";
  const actions = Array.isArray(args.actions) ? args.actions : [];
  if (actions.length === 0) {
    throw new Error("Give the simulator at least one action to try.");
  }

  const startDate = asDate(args.start, new Date());
  const endDate = new Date(startDate.getTime() + HORIZON_DAYS[horizon] * 86_400_000);

  const [existingEvents, existingReminders] = await Promise.all([
    listCalendarEvents({ start: toLocalIso(startDate), end: toLocalIso(endDate) }),
    listReminders().catch(() => []),
  ]);

  const timeline: TimelineEntry[] = [];
  const conflicts: string[] = [];
  const irreversible: string[] = [];

  let busyBefore = 0;
  for (const e of existingEvents) {
    const from = Math.max(new Date(e.start).getTime(), startDate.getTime());
    const to = Math.min(new Date(e.end).getTime(), endDate.getTime());
    if (to > from) busyBefore += hours(to - from);
  }
  let busyAfter = busyBefore;

  let proposedSpend = 0;

  for (const action of actions) {
    const at = asDate(action.at, startDate);
    const atIso = toLocalIso(at);
    const args_ = action.args ?? {};

    switch (action.tool) {
      case "create_calendar_event": {
        const from = asDate(args_.start, at);
        const to = asDate(args_.end, new Date(from.getTime() + 3_600_000));
        const clash = existingEvents.filter((e) =>
          overlaps(from.getTime(), to.getTime(), new Date(e.start).getTime(), new Date(e.end).getTime())
        );
        if (clash.length > 0) {
          conflicts.push(`"${action.summary ?? args_.title ?? "New event"}" overlaps ${clash.map((c) => `"${c.title}"`).join(", ")}`);
        }
        const clamped = Math.min(Math.max(busyStart(from, startDate, endDate), 0), hours(endDate.getTime() - startDate.getTime()));
        const clampedEnd = Math.min(Math.max(busyStart(to, startDate, endDate), 0), hours(endDate.getTime() - startDate.getTime()));
        busyAfter += Math.max(0, clampedEnd - clamped);
        timeline.push({
          at: atIso,
          title: action.summary ?? String(args_.title ?? "New event"),
          kind: "event",
          detail: `${from.toLocaleString()} – ${to.toLocaleTimeString()}`,
          simulated: true,
        });
        break;
      }
      case "schedule_reminder": {
        timeline.push({
          at: toLocalIso(asDate(args_.fireAt, at)),
          title: action.summary ?? String(args_.title ?? "Reminder"),
          kind: "reminder",
          detail: "Would fire as a local notification",
          simulated: true,
        });
        break;
      }
      case "add_expense": {
        const amount = Number(args_.amount ?? 0);
        proposedSpend += Number.isFinite(amount) ? amount : 0;
        timeline.push({
          at: atIso,
          title: action.summary ?? `Expense ${money(amount)} (${args_.category ?? "uncategorised"})`,
          kind: "expense",
          detail: args_.note ? String(args_.note) : undefined,
          simulated: true,
        });
        break;
      }
      case "send_text_message": {
        irreversible.push(action.summary ?? `Text to ${args_.phoneNumber ?? "someone"}`);
        timeline.push({
          at: atIso,
          title: action.summary ?? "Send a text",
          kind: "message",
          detail: "Cannot be undone once sent",
          simulated: true,
        });
        break;
      }
      default: {
        timeline.push({
          at: atIso,
          title: action.summary ?? action.tool,
          kind: "note",
          detail: "Dry run only",
          simulated: true,
        });
      }
    }
  }

  for (const r of existingReminders) {
    if (!r.fireAt) continue;
    const t = new Date(r.fireAt);
    if (Number.isNaN(t.getTime())) continue;
    if (t >= startDate && t <= endDate) {
      timeline.push({
        at: toLocalIso(t),
        title: r.title || "Reminder",
        kind: "reminder",
        detail: "Already scheduled",
      });
    }
  }

  timeline.sort((a, b) => (a.at < b.at ? -1 : 1));

  const spentBefore = sumExpenses(startDate, endDate);
  const spentAfter = spentBefore + proposedSpend;

  const impacts: Impact[] = [
    {
      label: `${horizon === "week" ? "Week" : "Day"} spending`,
      before: money(spentBefore),
      after: money(spentAfter),
      delta: `${proposedSpend >= 0 ? "+" : ""}${money(proposedSpend)}`,
      tone: proposedSpend > 0 ? "up" : proposedSpend < 0 ? "down" : "flat",
    },
    {
      label: "Calendar busy time",
      before: `${busyBefore.toFixed(1)} h`,
      after: `${busyAfter.toFixed(1)} h`,
      delta: `${busyAfter - busyBefore >= 0 ? "+" : ""}${(busyAfter - busyBefore).toFixed(1)} h`,
      tone: busyAfter > busyBefore ? "up" : busyAfter < busyBefore ? "down" : "flat",
    },
    {
      label: "Reminders",
      before: `${existingReminders.filter((r) => r.fireAt && !Number.isNaN(new Date(r.fireAt).getTime())).length}`,
      after: `${
        existingReminders.filter((r) => r.fireAt && !Number.isNaN(new Date(r.fireAt).getTime())).length +
        actions.filter((a) => a.tool === "schedule_reminder").length
      }`,
      delta: `+${actions.filter((a) => a.tool === "schedule_reminder").length}`,
      tone: actions.some((a) => a.tool === "schedule_reminder") ? "up" : "flat",
    },
  ];

  const summaryParts = [
    `${actions.length} action${actions.length === 1 ? "" : "s"} simulated over the next ${horizon === "week" ? "week" : "day"}.`,
    proposedSpend !== 0 ? `Spending would change by ${money(proposedSpend)}.` : "No spending change.",
    conflicts.length > 0 ? `${conflicts.length} calendar conflict${conflicts.length === 1 ? "" : "s"}.` : "No calendar conflicts.",
    irreversible.length > 0 ? `Not reversible: ${irreversible.join("; ")}.` : "Everything simulated is reversible.",
  ];

  return {
    horizon,
    start: toLocalIso(startDate),
    end: toLocalIso(endDate),
    timeline,
    impacts,
    conflicts,
    irreversible,
    summary: summaryParts.join(" "),
    simulated: true,
  };
}

function busyStart(d: Date, start: Date, end: Date): number {
  return Math.max(0, hours(Math.min(d.getTime(), end.getTime()) - start.getTime()));
}

function sumExpenses(start: Date, end: Date): number {
  return queryExpenses({})
    .filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= start.getTime() && t <= end.getTime();
    })
    .reduce((n, r) => n + r.amount, 0);
}

function toLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}