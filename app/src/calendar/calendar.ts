import * as Calendar from "expo-calendar";
import type { CalendarEvent } from "../core/types";

export interface CalendarService {
  listEvents(startMs: number, endMs: number): Promise<CalendarEvent[]>;
}

let permissionChecked = false;
let permissionGranted = false;

async function ensurePermission(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;
  permissionChecked = true;
  const existing = await Calendar.getCalendarPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Calendar.requestCalendarPermissionsAsync()).status;
  }
  permissionGranted = status === "granted";
  return permissionGranted;
}

function toMs(d: string | Date): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

// Real, device-backed calendar reader. Best-effort: permission denial or any
// error resolves to [] so Agenda/briefing degrade to local-only.
export function createCalendar(): CalendarService {
  return {
    async listEvents(startMs, endMs) {
      try {
        if (!(await ensurePermission())) return [];
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const ids = calendars.map((c) => c.id);
        if (ids.length === 0) return [];
        const events = await Calendar.getEventsAsync(ids, new Date(startMs), new Date(endMs));
        return events.map((e) => ({
          id: e.id,
          title: e.title?.trim() || "(busy)",
          startMs: toMs(e.startDate),
          endMs: e.endDate ? toMs(e.endDate) : null,
          allDay: !!e.allDay,
        }));
      } catch {
        return [];
      }
    },
  };
}

export function createNoopCalendar(): CalendarService {
  return { async listEvents() { return []; } };
}
