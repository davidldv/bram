import type { Plan, CalendarEvent } from "./types";
import { planGroup, type PlanGroup } from "../ui/relative-time";

export type AgendaItem =
  | { kind: "plan"; plan: Plan }
  | { kind: "event"; event: CalendarEvent };

export interface AgendaGroup {
  group: PlanGroup;
  items: AgendaItem[];
}

const ORDER: PlanGroup[] = ["today", "upcoming", "someday"];

function time(it: AgendaItem): number {
  return it.kind === "plan" ? it.plan.scheduledAt ?? Infinity : it.event.startMs;
}

function doneRank(it: AgendaItem): number {
  return it.kind === "plan" && it.plan.done ? 1 : 0;
}

function groupOf(it: AgendaItem, now: number): PlanGroup {
  return planGroup(now, it.kind === "plan" ? it.plan.scheduledAt : it.event.startMs);
}

// Merge local plans and device calendar events into ordered, grouped buckets.
// Pure so the Agenda screen stays a thin renderer.
export function buildAgenda(
  plans: Plan[],
  events: CalendarEvent[],
  now: number
): AgendaGroup[] {
  const items: AgendaItem[] = [
    ...plans.map((plan): AgendaItem => ({ kind: "plan", plan })),
    ...events.map((event): AgendaItem => ({ kind: "event", event })),
  ];
  return ORDER.map((group) => ({
    group,
    items: items
      .filter((it) => groupOf(it, now) === group)
      .sort((a, b) => doneRank(a) - doneRank(b) || time(a) - time(b)),
  })).filter((g) => g.items.length > 0);
}
