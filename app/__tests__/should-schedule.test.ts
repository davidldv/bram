import { shouldSchedule } from "../src/notify/should-schedule";
import type { Plan } from "../src/core/types";

const now = new Date(2026, 5, 20, 8, 0).getTime();

function plan(over: Partial<Plan>): Plan {
  return { id: "p1", type: "reminder", title: "x", scheduledAt: null, createdAt: now, done: false, ...over };
}

describe("shouldSchedule", () => {
  it("schedules a future timed plan", () => {
    expect(shouldSchedule(plan({ scheduledAt: now + 60_000 }), now)).toBe(true);
  });
  it("does not schedule a past time", () => {
    expect(shouldSchedule(plan({ scheduledAt: now - 60_000 }), now)).toBe(false);
  });
  it("does not schedule a plan with no time", () => {
    expect(shouldSchedule(plan({ type: "task", scheduledAt: null }), now)).toBe(false);
  });
});
