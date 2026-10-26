const LABELS: Record<string, string> = {
  get_current_location: "Getting your location",
  list_calendar_events: "Checking your calendar",
  create_calendar_event: "Creating calendar event",
  schedule_reminder: "Scheduling reminder",
  query_expenses: "Looking up your expenses",
  add_expense: "Adding expense",
  remember: "Saving to memory",
  recall: "Recalling memory",
  find_contact: "Searching contacts",
  send_text_message: "Opening messages",
  undo_last_action: "Undoing last action",
  schedule_daily_checkin: "Scheduling daily check-in",
  export_expenses_csv: "Exporting expenses",
  create_commitment: "Tracking a commitment",
  list_commitments: "Checking your commitments",
  complete_commitment: "Completing a commitment",
  simulate_plan: "Simulating the plan",
};

const ICONS: Record<string, string> = {
  get_current_location: "📍",
  list_calendar_events: "📅",
  create_calendar_event: "📅",
  schedule_reminder: "⏰",
  query_expenses: "💵",
  add_expense: "💵",
  remember: "🧠",
  recall: "🧠",
  find_contact: "👤",
  send_text_message: "💬",
  undo_last_action: "↩️",
  schedule_daily_checkin: "🌅",
  export_expenses_csv: "📤",
  create_commitment: "🤝",
  list_commitments: "📋",
  complete_commitment: "✅",
  simulate_plan: "🔮",
};

export function toolLabel(name: string): string {
  return LABELS[name] ?? name;
}

export function toolIcon(name: string): string {
  return ICONS[name] ?? "⚙️";
}

export function toolConfirmationCopy(name: string, args: Record<string, any>): { title: string; body: string } {
  switch (name) {
    case "create_calendar_event":
      return {
        title: `Create "${args.title}"?`,
        body: `${formatRange(args.start, args.end)}${args.location ? `\n${args.location}` : ""}`,
      };
    case "schedule_reminder":
      return {
        title: `Schedule reminder "${args.title}"?`,
        body: `${args.body ?? ""}\nFires at ${formatDate(args.fireAt)}`,
      };
    case "add_expense":
      return {
        title: `Log expense?`,
        body: `$${args.amount} · ${args.category}${args.note ? ` · ${args.note}` : ""}`,
      };
    case "send_text_message":
      return {
        title: `Send text to ${args.phoneNumber}?`,
        body: args.message ?? "",
      };
    case "undo_last_action":
      return {
        title: "Undo the last action?",
        body: "This will reverse whatever Ava just did.",
      };
    case "schedule_daily_checkin":
      return {
        title: "Set up daily check-in?",
        body: `A reminder will fire every day at ${String(args.hour).padStart(2, "0")}:${String(
          args.minute
        ).padStart(2, "0")}.`,
      };
    default:
      return { title: toolLabel(name), body: JSON.stringify(args) };
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatRange(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const date = s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const startTime = s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const endTime = e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${date}, ${startTime} – ${endTime}`;
  } catch {
    return `${start} – ${end}`;
  }
}
