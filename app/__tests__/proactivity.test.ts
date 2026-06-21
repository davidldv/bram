import { planLeadups, syncProactiveNotifications, LEAD_MS } from "../src/core/proactivity";
import type { CalendarEvent } from "../src/core/types";
import type { Notifier } from "../src/notify/notifier";

const now = new Date(2026, 5, 20, 8, 0).getTime();

function event(over: Partial<CalendarEvent>): CalendarEvent {
  return { id: "e", title: "meeting", startMs: now + 3600_000, endMs: null, allDay: false, ...over };
}

describe("planLeadups", () => {
  it("schedules a heads-up leadMs before a future event", () => {
    const start = now + 60 * 60 * 1000;
    const notes = planLeadups([event({ id: "a", title: "Sync", startMs: start })], now, LEAD_MS);
    expect(notes).toEqual([
      { id: "evt-a", title: "Sync", body: "In 10 minutes", whenMs: start - LEAD_MS },
    ]);
  });

  it("skips events whose lead window already passed", () => {
    // starts in 5 min → lead time (10 min before) is in the past
    expect(planLeadups([event({ startMs: now + 5 * 60 * 1000 })], now, LEAD_MS)).toEqual([]);
    // already started
    expect(planLeadups([event({ startMs: now - 60_000 })], now, LEAD_MS)).toEqual([]);
  });

  it("skips all-day events", () => {
    expect(planLeadups([event({ startMs: now + 3600_000, allDay: true })], now, LEAD_MS)).toEqual([]);
  });

  it("returns empty for no events", () => {
    expect(planLeadups([], now, LEAD_MS)).toEqual([]);
  });
});

describe("syncProactiveNotifications", () => {
  it("schedules a heads-up per eligible event", async () => {
    const start = now + 2 * 60 * 60 * 1000;
    const calendar = { listEvents: jest.fn(async () => [event({ id: "x", title: "Standup", startMs: start })]) };
    const scheduleAt = jest.fn(async (_note: { id: string; whenMs: number }) => {});
    const notifier = { schedule: jest.fn(), cancel: jest.fn(), scheduleAt } as unknown as Notifier;
    await syncProactiveNotifications({ calendar, notifier, now });
    expect(scheduleAt).toHaveBeenCalledTimes(1);
    expect(scheduleAt.mock.calls[0][0]).toMatchObject({ id: "evt-x", whenMs: start - LEAD_MS });
  });

  it("does not throw when the calendar fails", async () => {
    const calendar = { listEvents: jest.fn(async () => { throw new Error("nope"); }) };
    const notifier = { schedule: jest.fn(), cancel: jest.fn(), scheduleAt: jest.fn() } as unknown as Notifier;
    await expect(syncProactiveNotifications({ calendar, notifier, now })).resolves.toBeUndefined();
  });
});
