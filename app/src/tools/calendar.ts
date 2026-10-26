import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

let cachedCalendar: Calendar.ExpoCalendar | null = null;

async function getWritableCalendar(): Promise<Calendar.ExpoCalendar> {
  if (cachedCalendar) return cachedCalendar;

  const { status } = await Calendar.requestCalendarPermissions();
  if (status !== "granted") {
    throw new Error("Calendar permission was not granted.");
  }

  if (Platform.OS === "ios") {
    const defaultCal = Calendar.getDefaultCalendarSync();
    if (defaultCal?.allowsModifications) {
      cachedCalendar = defaultCal;
      return defaultCal;
    }
  }

  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((c) => c.allowsModifications);
  const existing = writable.find((c) => c.isPrimary) ?? writable[0];

  if (existing) {
    cachedCalendar = existing;
    return existing;
  }

  const created = await Calendar.createCalendar({
    title: "Ava Agent",
    color: "#7C5CFF",
    entityType: Calendar.EntityTypes.EVENT,
  });
  cachedCalendar = created;
  return created;
}

export async function listCalendarEvents(args: { start: string; end: string }) {
  const calendar = await getWritableCalendar();
  const events = await calendar.listEvents(new Date(args.start), new Date(args.end));
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.startDate,
    end: e.endDate,
    location: e.location ?? null,
  }));
}

export async function createCalendarEvent(args: {
  title: string;
  start: string;
  end: string;
  notes?: string;
  location?: string;
  attendeeEmail?: string;
}) {
  const calendar = await getWritableCalendar();
  const created = await calendar.createEvent({
    title: args.title,
    startDate: new Date(args.start),
    endDate: new Date(args.end),
    notes: args.notes,
    location: args.location,
  });

  let invited = false;
  if (args.attendeeEmail) {
    try {
      await created.createAttendee({
        email: args.attendeeEmail,
        name: args.attendeeEmail,
        role: Calendar.AttendeeRole.REQUIRED,
        status: Calendar.AttendeeStatus.PENDING,
        type: Calendar.AttendeeType.PERSON,
      });
      invited = true;
    } catch {
      // Attendee invites only actually send an email when the event lives on a
      // synced account (e.g. Google Calendar) — a purely local calendar silently
      // can't do this. Report it rather than claiming an invite went out.
      invited = false;
    }
  }

  return {
    id: created.id,
    title: args.title,
    start: args.start,
    end: args.end,
    attendeeEmail: args.attendeeEmail ?? null,
    invited,
  };
}

export async function deleteCalendarEvent(eventId: string) {
  const event = await Calendar.ExpoCalendarEvent.get(eventId);
  await event.delete();
}
