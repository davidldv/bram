import { buildAgenda } from "../src/core/agenda";
import type { Plan, CalendarEvent } from "../src/core/types";

const now = new Date(2026, 5, 20, 8, 0).getTime();

function plan(over: Partial<Plan>): Plan {
  return { id: "p", type: "task", title: "t", scheduledAt: null, createdAt: now, done: false, ...over };
}
function event(over: Partial<CalendarEvent>): CalendarEvent {
  return { id: "e", title: "meeting", startMs: now, endMs: null, allDay: false, ...over };
}

describe("buildAgenda", () => {
  it("returns no groups when empty", () => {
    expect(buildAgenda([], [], now)).toEqual([]);
  });

  it("groups plans and events into today/upcoming/someday", () => {
    const groups = buildAgenda(
      [
        plan({ id: "today-plan", scheduledAt: new Date(2026, 5, 20, 15, 0).getTime() }),
        plan({ id: "someday", scheduledAt: null }),
      ],
      [
        event({ id: "today-evt", startMs: new Date(2026, 5, 20, 10, 0).getTime() }),
        event({ id: "next-week", startMs: new Date(2026, 5, 24, 9, 0).getTime() }),
      ],
      now
    );
    const byGroup = Object.fromEntries(groups.map((g) => [g.group, g.items]));
    // Today: event at 10:00 before plan at 15:00 (time-sorted)
    expect(byGroup.today.map((i) => (i.kind === "plan" ? i.plan.id : i.event.id))).toEqual([
      "today-evt",
      "today-plan",
    ]);
    expect(byGroup.upcoming.map((i) => (i.kind === "event" ? i.event.id : i.plan.id))).toEqual([
      "next-week",
    ]);
    expect(byGroup.someday.map((i) => (i.kind === "plan" ? i.plan.id : i.event.id))).toEqual([
      "someday",
    ]);
  });

  it("sorts done plans last within a group", () => {
    const groups = buildAgenda(
      [
        plan({ id: "done", scheduledAt: new Date(2026, 5, 20, 9, 0).getTime(), done: true }),
        plan({ id: "open", scheduledAt: new Date(2026, 5, 20, 18, 0).getTime(), done: false }),
      ],
      [],
      now
    );
    expect(groups[0].items.map((i) => (i.kind === "plan" ? i.plan.id : ""))).toEqual(["open", "done"]);
  });
});
