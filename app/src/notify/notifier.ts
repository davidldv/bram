import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Plan } from "../core/types";

export interface Notifier {
  schedule(plan: Plan): Promise<void>;
  cancel(planId: string): Promise<void>;
}

// Show a banner even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let permissionChecked = false;
let permissionGranted = false;

async function ensurePermission(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;
  permissionChecked = true;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  permissionGranted = status === "granted";
  return permissionGranted;
}

// Real, device-backed notifier. Best-effort: failures never throw so they can't
// break capture or mark-done.
export function createNotifier(getPersona: () => Promise<string>): Notifier {
  return {
    async schedule(plan) {
      if (plan.scheduledAt == null) return;
      try {
        if (!(await ensurePermission())) return;
        const persona = await getPersona();
        await Notifications.scheduleNotificationAsync({
          identifier: plan.id,
          content: { title: plan.title, body: `From ${persona}` },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(plan.scheduledAt),
          },
        });
      } catch {
        // ponytail: swallow; a missed schedule shouldn't break capture.
      }
    },
    async cancel(planId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(planId);
      } catch {
        // no-op if it was never scheduled
      }
    },
  };
}

export function createNoopNotifier(): Notifier {
  return { async schedule() {}, async cancel() {} };
}
