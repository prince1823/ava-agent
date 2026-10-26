import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { setCommitmentStatus } from "../db/db";

/**
 * Ambient surface, JS half.
 *
 * A reminder can carry a deep link and an action button, so tapping it lands on the
 * right screen and a promise can be completed without opening the app first.
 *
 * This is native-only and deliberately loaded lazily so the web bundle never pulls
 * expo-notifications in. The full ambient story — Live Activity, home-screen widget,
 * Siri/App Intents — needs native targets and is not built here.
 */
export const COMMITMENT_CATEGORY = "ava-commitment";

interface NotificationActionResponse {
  actionIdentifier: string;
  notification: {
    request: {
      content: {
        data?: Record<string, unknown>;
      };
    };
  };
}

export function AmbientBridge() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    let cancelled = false;
    let subscription: { remove: () => void } | undefined;

    const handle = (response: NotificationActionResponse) => {
      const data = response.notification?.request?.content?.data ?? {};

      if (response.actionIdentifier === "done" && typeof data.commitmentId === "string") {
        setCommitmentStatus(data.commitmentId, "done");
      }

      const route = typeof data.route === "string" ? data.route : "/";
      try {
        router.push(route as never);
      } catch {
        /* navigation failed; the notification still resolved the action */
      }
    };

    (async () => {
      try {
        const Notifications = await import("expo-notifications");

        // Buttons shown on a commitment reminder.
        await Notifications.setNotificationCategoryAsync(COMMITMENT_CATEGORY, [
          { identifier: "done", buttonTitle: "Mark done" },
          { identifier: "open", buttonTitle: "Open Ava" },
        ]).catch(() => {});

        const last = await Notifications.getLastNotificationResponseAsync().catch(() => null);
        if (!cancelled && last) handle(last as unknown as NotificationActionResponse);

        subscription = Notifications.addNotificationResponseReceivedListener((response) =>
          handle(response as unknown as NotificationActionResponse)
        );
      } catch {
        /* expo-notifications unavailable in this build */
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return null;
}