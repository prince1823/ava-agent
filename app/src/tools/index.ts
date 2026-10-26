import { getCurrentLocation } from "./location";
import { listCalendarEvents, createCalendarEvent } from "./calendar";
import { scheduleReminder, scheduleDailyCheckin } from "./reminders";
import { findContact, composeTextMessage } from "./contacts";
import { exportExpensesCsv } from "./export";
import { undoLastAction } from "./undo";
import { simulatePlan, type SimulatedAction } from "./simulate";
import {
  queryExpenses,
  addExpense,
  rememberFact,
  recallFacts,
  logAction,
  createCommitment,
  listCommitments,
  findCommitment,
  setCommitmentStatus,
  type CommitmentStatus,
} from "../db/db";

export type ToolName =
  | "get_current_location"
  | "list_calendar_events"
  | "create_calendar_event"
  | "schedule_reminder"
  | "query_expenses"
  | "add_expense"
  | "remember"
  | "recall"
  | "find_contact"
  | "send_text_message"
  | "undo_last_action"
  | "schedule_daily_checkin"
  | "export_expenses_csv"
  | "create_commitment"
  | "list_commitments"
  | "complete_commitment"
  | "simulate_plan";

export async function executeTool(name: ToolName, args: Record<string, any>): Promise<unknown> {
  switch (name) {
    case "get_current_location":
      return getCurrentLocation();

    case "list_calendar_events":
      return listCalendarEvents({ start: args.start, end: args.end });

    case "create_calendar_event": {
      const created = await createCalendarEvent({
        title: args.title,
        start: args.start,
        end: args.end,
        notes: args.notes,
        location: args.location,
      });
      logAction("calendar_event", created.id, `Calendar event "${created.title}"`);
      return created;
    }

    case "schedule_reminder": {
      const created = await scheduleReminder({ title: args.title, body: args.body, fireAt: args.fireAt });
      logAction("reminder", created.id, `Reminder "${created.title}"`);
      return created;
    }

    case "query_expenses":
      return queryExpenses({ category: args.category, since: args.since, until: args.until });

    case "add_expense": {
      const created = addExpense(args.amount, args.category, args.note);
      logAction("expense", String(created.id), `Expense $${created.amount} (${created.category})`);
      return created;
    }

    case "remember":
      rememberFact(args.key, args.value);
      return { ok: true };

    case "recall":
      return recallFacts(args.key);

    case "find_contact":
      return findContact({ name: args.name });

    case "send_text_message":
      return composeTextMessage({ phoneNumber: args.phoneNumber, message: args.message });

    case "undo_last_action":
      return undoLastAction();

    case "schedule_daily_checkin":
      return scheduleDailyCheckin({ hour: args.hour, minute: args.minute });

    case "export_expenses_csv":
      return exportExpensesCsv({ since: args.since, until: args.until, category: args.category });

    case "create_commitment": {
      const created = createCommitment({
        title: args.title,
        dueAt: args.dueAt,
        person: args.person,
        detail: args.detail,
      });
      return created;
    }

    case "list_commitments":
      return listCommitments((args.status as CommitmentStatus | "all") ?? "open");

    case "complete_commitment": {
      const found = findCommitment(String(args.idOrText ?? ""));
      if (!found) {
        throw new Error(`No open commitment matches "${args.idOrText}".`);
      }
      return setCommitmentStatus(found.id, "done");
    }

    case "simulate_plan":
      return simulatePlan({
        actions: (args.actions as SimulatedAction[]) ?? [],
        horizon: args.horizon === "week" ? "week" : "day",
        start: args.start,
      });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
