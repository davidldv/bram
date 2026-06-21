import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Plan } from "../core/types";

export interface Notifier {
  schedule(plan: Plan): Promise<void>;
  scheduleAt(note: { id: string; title: string; body: string; whenMs: number }): Promise<void>;
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
  const notifier: Notifier = {
    async scheduleAt(note) {
      try {
        if (!(await ensurePermission())) return;
        await Notifications.scheduleNotificationAsync({
          identifier: note.id,
          content: { title: note.title, body: note.body },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(note.whenMs),
          },
        });
      } catch {
        // ponytail: swallow; a missed schedule shouldn't break the app.
      }
    },
    async schedule(plan) {
      if (plan.scheduledAt == null) return;
      const persona = await getPersona().catch(() => "Bram");
      await notifier.scheduleAt({
        id: plan.id,
        title: plan.title,
        body: `From ${persona}`,
        whenMs: plan.scheduledAt,
      });
    },
    async cancel(planId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(planId);
      } catch {
        // no-op if it was never scheduled
      }
    },
  };
  return notifier;
}

export function createNoopNotifier(): Notifier {
  return { async schedule() {}, async scheduleAt() {}, async cancel() {} };
}
