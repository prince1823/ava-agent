// Web build has no Calendar API (expo-calendar returns [] and denies permissions),
// so the web surface uses a seeded fixture week. Created events persist in
// localStorage, which keeps the demo coherent across reloads.

const KEY = "ava.web.calendar";

interface FixtureEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Local wall-clock ISO, matching the format the agent uses for tool arguments.
function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return localIso(d);
}

function seedWeek(): FixtureEvent[] {
  return [
    { id: "fx-1", title: "Standup", start: at(0, 9, 30), end: at(0, 10, 0), location: "Zoom" },
    { id: "fx-2", title: "Design review", start: at(0, 14, 0), end: at(0, 15, 0), location: "Studio" },
    { id: "fx-3", title: "Gym", start: at(0, 18, 30), end: at(0, 19, 30), location: "Fitline" },
    { id: "fx-4", title: "Dinner with Priya", start: at(1, 19, 0), end: at(1, 21, 0), location: "Olive" },
    { id: "fx-5", title: "1:1 with Sam", start: at(2, 11, 0), end: at(2, 11, 30), location: null },
    { id: "fx-6", title: "Dentist", start: at(3, 15, 0), end: at(3, 15, 45), location: "City Dental" },
  ];
}

function load(): FixtureEvent[] {
  if (typeof localStorage === "undefined") return seedWeek();
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as FixtureEvent[];
    } catch {
      /* fall through to seed */
    }
  }
  const seeded = seedWeek();
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

function save(events: FixtureEvent[]) {
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(events));
}

export async function listCalendarEvents(args: { start: string; end: string }) {
  const from = new Date(args.start).getTime();
  const to = new Date(args.end).getTime();
  return load()
    .filter((e) => {
      const t = new Date(e.start).getTime();
      return t >= from && t <= to;
    })
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end, location: e.location }));
}

export async function createCalendarEvent(args: {
  title: string;
  start: string;
  end: string;
  notes?: string;
  location?: string;
  attendeeEmail?: string;
}) {
  const events = load();
  const id = `web-${Date.now().toString(36)}`;
  events.push({
    id,
    title: args.title,
    start: args.start,
    end: args.end,
    location: args.location ?? null,
  });
  save(events);
  return {
    id,
    title: args.title,
    start: args.start,
    end: args.end,
    attendeeEmail: args.attendeeEmail ?? null,
    invited: false,
    simulated: true,
  };
}

export async function deleteCalendarEvent(eventId: string) {
  save(load().filter((e) => e.id !== eventId));
}