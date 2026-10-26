import type OpenAI from "openai";

export type ToolExecutor = "client" | "server";

export interface ToolDefinition {
  spec: OpenAI.Chat.Completions.ChatCompletionTool;
  executor: ToolExecutor;
  /** Whether this tool mutates real-world state and needs explicit user confirmation before running. */
  requiresConfirmation: boolean;
}

function tool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  executor: ToolExecutor,
  requiresConfirmation = false
): ToolDefinition {
  return {
    spec: {
      type: "function",
      function: { name, description, parameters },
    },
    executor,
    requiresConfirmation,
  };
}

export const TOOLS: Record<string, ToolDefinition> = {
  get_current_location: tool(
    "get_current_location",
    "Get the user's current GPS location (lat/lng and a human-readable place name). Use this before any location-based suggestion or search.",
    { type: "object", properties: {}, required: [] },
    "client",
    false
  ),

  list_calendar_events: tool(
    "list_calendar_events",
    "List the user's calendar events in a given date range (ISO 8601 dates).",
    {
      type: "object",
      properties: {
        start: { type: "string", description: "ISO 8601 start datetime" },
        end: { type: "string", description: "ISO 8601 end datetime" },
      },
      required: ["start", "end"],
    },
    "client",
    false
  ),

  create_calendar_event: tool(
    "create_calendar_event",
    "Create a new event on the user's device calendar. This is a real, visible action — always confirmed with the user first.",
    {
      type: "object",
      properties: {
        title: { type: "string" },
        start: { type: "string", description: "ISO 8601 start datetime" },
        end: { type: "string", description: "ISO 8601 end datetime" },
        notes: { type: "string" },
        location: { type: "string" },
      },
      required: ["title", "start", "end"],
    },
    "client",
    true
  ),

  schedule_reminder: tool(
    "schedule_reminder",
    "Schedule a local push notification reminder on the user's device at a specific time.",
    {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        fireAt: { type: "string", description: "ISO 8601 datetime to fire the reminder" },
      },
      required: ["title", "body", "fireAt"],
    },
    "client",
    true
  ),

  query_expenses: tool(
    "query_expenses",
    "Query the user's local expense database. Use natural filters like category or date range to answer spending questions.",
    {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category filter, e.g. food, transport" },
        since: { type: "string", description: "Optional ISO 8601 date to filter from" },
        until: { type: "string", description: "Optional ISO 8601 date to filter to" },
      },
      required: [],
    },
    "client",
    false
  ),

  add_expense: tool(
    "add_expense",
    "Add a new expense entry to the user's local expense database.",
    {
      type: "object",
      properties: {
        amount: { type: "number" },
        category: { type: "string" },
        note: { type: "string" },
      },
      required: ["amount", "category"],
    },
    "client",
    true
  ),

  remember: tool(
    "remember",
    "Save a durable fact or preference about the user to long-term memory, so it can be recalled in future conversations (e.g. dietary preference, recurring goals).",
    {
      type: "object",
      properties: {
        key: { type: "string", description: "Short key, e.g. 'diet_preference'" },
        value: { type: "string" },
      },
      required: ["key", "value"],
    },
    "client",
    false
  ),

  recall: tool(
    "recall",
    "Retrieve previously remembered facts about the user. Call with no key to list everything remembered.",
    {
      type: "object",
      properties: {
        key: { type: "string", description: "Optional specific key to recall" },
      },
      required: [],
    },
    "client",
    false
  ),

  find_contact: tool(
    "find_contact",
    "Search the user's device contacts by name. Use this before send_text_message to find a contact's phone number.",
    {
      type: "object",
      properties: {
        name: { type: "string", description: "Full or partial name to search for" },
      },
      required: ["name"],
    },
    "client",
    false
  ),

  send_text_message: tool(
    "send_text_message",
    "Open the device's messaging app with a pre-filled text message to a phone number, ready for the user to review and send. This is a real, visible action — always confirmed with the user first. Use find_contact first if you only have a name.",
    {
      type: "object",
      properties: {
        phoneNumber: { type: "string" },
        message: { type: "string" },
      },
      required: ["phoneNumber", "message"],
    },
    "client",
    true
  ),

  undo_last_action: tool(
    "undo_last_action",
    "Undo the single most recent real-world action this agent took (the last created calendar event, scheduled reminder, or logged expense). Call this only when the user explicitly asks to undo, cancel, or remove what was just done.",
    { type: "object", properties: {}, required: [] },
    "client",
    true
  ),

  schedule_daily_checkin: tool(
    "schedule_daily_checkin",
    "Schedule a recurring daily local notification that nudges the user to open the app for a calendar + spending summary. Replaces any previous daily check-in time.",
    {
      type: "object",
      properties: {
        hour: { type: "number", description: "Hour of day in 24h local time, 0-23" },
        minute: { type: "number", description: "Minute, 0-59" },
      },
      required: ["hour", "minute"],
    },
    "client",
    true
  ),

  export_expenses_csv: tool(
    "export_expenses_csv",
    "Export the user's expenses as a CSV file and open the native share sheet so they can save or send it. Optionally filter by category or date range.",
    {
      type: "object",
      properties: {
        category: { type: "string" },
        since: { type: "string", description: "Optional ISO 8601 date to filter from" },
        until: { type: "string", description: "Optional ISO 8601 date to filter to" },
      },
      required: [],
    },
    "client",
    false
  ),

  create_commitment: tool(
    "create_commitment",
    "Save a promise or intention the user made — to themselves or to someone else — so Ava can follow up on it later. Use when the user says things like \"I need to\", \"I promised\", \"remind me to follow up on\", or \"don't let me forget\". This only records the commitment; it does not schedule a notification.",
    {
      type: "object",
      properties: {
        title: { type: "string", description: "Short description of what was promised, e.g. 'Send the invoice'" },
        dueAt: {
          type: "string",
          description:
            "Optional local wall-clock ISO datetime the promise is due (no Z, no offset), resolved from phrases like 'by Friday'.",
        },
        person: { type: "string", description: "Optional person the promise was made to" },
        detail: { type: "string", description: "Optional extra context, e.g. the amount or what was agreed" },
      },
      required: ["title"],
    },
    "client",
    false
  ),

  list_commitments: tool(
    "list_commitments",
    "List the promises the user has open (or already completed). Use this before answering questions like \"what did I promise Priya?\" or \"what's still hanging?\".",
    {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["open", "done", "dropped", "all"],
          description: "Which commitments to list. Defaults to open.",
        },
      },
      required: [],
    },
    "client",
    false
  ),

  complete_commitment: tool(
    "complete_commitment",
    "Mark a promise as done. Accepts either the commitment id or the wording/person the user used, e.g. 'the invoice' or 'Priya'.",
    {
      type: "object",
      properties: {
        idOrText: { type: "string", description: "Commitment id, title fragment, or person name" },
      },
      required: ["idOrText"],
    },
    "client",
    false
  ),

  simulate_plan: tool(
    "simulate_plan",
    "Dry-run a proposed plan without changing anything, then report the timeline, spending change, calendar conflicts and anything irreversible. Use for 'what if' questions such as \"what if I skip the gym and take a cab?\" or before committing to a multi-step plan. Never writes to the calendar, expenses or reminders.",
    {
      type: "object",
      properties: {
        horizon: {
          type: "string",
          enum: ["day", "week"],
          description: "How far ahead to simulate. Defaults to day.",
        },
        start: {
          type: "string",
          description: "Optional local wall-clock ISO datetime the simulation starts at (no Z, no offset). Defaults to now.",
        },
        actions: {
          type: "array",
          description: "The proposed actions to try out. Each is a tool call that would be made, without making it.",
          items: {
            type: "object",
            properties: {
              tool: {
                type: "string",
                enum: [
                  "create_calendar_event",
                  "schedule_reminder",
                  "add_expense",
                  "send_text_message",
                  "note",
                ],
              },
              summary: { type: "string", description: "One-line description of the action for the timeline" },
              at: { type: "string", description: "Optional local wall-clock ISO datetime for the action" },
              args: {
                type: "object",
                description: "The arguments that tool would receive, e.g. {title, start, end} for create_calendar_event",
              },
            },
            required: ["tool"],
          },
        },
      },
      required: ["actions"],
    },
    "client",
    false
  ),
};

export const TOOL_SPECS = Object.values(TOOLS).map((t) => t.spec);
