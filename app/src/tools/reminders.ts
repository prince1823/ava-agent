import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function ensureNotificationPermission() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Ava reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  if (finalStatus !== "granted") {
    throw new Error("Notification permission was not granted.");
  }
}

export async function scheduleReminder(args: {
  title: string;
  body: string;
  fireAt: string;
  /** Extra payload carried to the tap handler, e.g. { route, commitmentId }. */
  data?: Record<string, unknown>;
  /** Notification category, which decides which action buttons appear. */
  categoryIdentifier?: string;
}) {
  await ensureNotificationPermission();

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: args.title,
      body: args.body,
      data: args.data ?? {},
      categoryIdentifier: args.categoryIdentifier,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(args.fireAt),
    },
  });

  return { id: identifier, title: args.title, fireAt: args.fireAt };
}

export async function cancelReminder(identifier: string) {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

/** Read-only view of scheduled reminders, used by the simulator's dry-run. */
export async function listReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map((n) => {
    const trigger = n.trigger as { date?: number | string; type?: string } | null;
    return {
      id: n.identifier,
      title: n.content.title ?? "",
      body: n.content.body ?? "",
      fireAt: trigger?.date ? new Date(trigger.date as string | number).toISOString() : null,
      daily: trigger?.type === Notifications.SchedulableTriggerInputTypes.DAILY,
    };
  });
}

export async function scheduleDailyCheckin(args: { hour: number; minute: number }) {
  await ensureNotificationPermission();

  // Replace any existing daily check-in rather than stacking duplicates.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    if (n.content.data?.avaDailyCheckin) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Good morning",
      body: "Open Ava for your calendar and spending summary.",
      data: { avaDailyCheckin: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: args.hour,
      minute: args.minute,
    },
  });

  return { id: identifier, hour: args.hour, minute: args.minute };
}
