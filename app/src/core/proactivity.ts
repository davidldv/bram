import type { CalendarEvent } from "./types";
import type { Notifier } from "../notify/notifier";
import type { CalendarService } from "../calendar/calendar";

export const LEAD_MS = 10 * 60 * 1000;
const HORIZON_DAYS = 14;

export interface ScheduledNote {
  id: string;
  title: string;
  body: string;
  whenMs: number;
}

// Pure: one heads-up per upcoming timed event, leadMs before it starts.
// Skips all-day events and anything whose lead time is already past.
export function planLeadups(
  events: CalendarEvent[],
  now: number,
  leadMs: number
): ScheduledNote[] {
  const notes: ScheduledNote[] = [];
  for (const e of events) {
    if (e.allDay) continue;
    const whenMs = e.startMs - leadMs;
    if (whenMs <= now) continue;
    notes.push({
      id: `evt-${e.id}`,
      title: e.title,
      body: `In ${Math.round(leadMs / 60000)} minutes`,
      whenMs,
    });
  }
  return notes;
}

// Scan upcoming calendar events on app open and (re)schedule their heads-ups.
// Deterministic ids make re-runs idempotent. Best-effort: never throws.
export async function syncProactiveNotifications(deps: {
  calendar: CalendarService;
  notifier: Notifier;
  now: number;
}): Promise<void> {
  try {
    const horizon = deps.now + HORIZON_DAYS * 24 * 60 * 60 * 1000;
    const events = await deps.calendar.listEvents(deps.now, horizon);
    for (const note of planLeadups(events, deps.now, LEAD_MS)) {
      await deps.notifier.scheduleAt(note);
    }
  } catch {
    // proactivity must never break app startup
  }
}
