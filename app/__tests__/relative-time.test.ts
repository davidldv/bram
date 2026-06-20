import { formatRelative, planGroup } from "../src/ui/relative-time";

const now = new Date(2026, 5, 20, 8, 0).getTime(); // 2026-06-20 08:00 local

describe("formatRelative", () => {
  it("labels null as Someday", () => {
    expect(formatRelative(now, null)).toBe("Someday");
  });
  it("labels same-day with Today + 12h time", () => {
    expect(formatRelative(now, new Date(2026, 5, 20, 15, 0).getTime())).toBe("Today 3:00 PM");
    expect(formatRelative(now, new Date(2026, 5, 20, 0, 5).getTime())).toBe("Today 12:05 AM");
  });
  it("labels next day as Tomorrow", () => {
    expect(formatRelative(now, new Date(2026, 5, 21, 9, 0).getTime())).toBe("Tomorrow 9:00 AM");
  });
  it("labels further dates as Mon D + time", () => {
    expect(formatRelative(now, new Date(2026, 5, 25, 14, 30).getTime())).toBe("Jun 25 2:30 PM");
  });
});

describe("planGroup", () => {
  it("buckets null as someday", () => {
    expect(planGroup(now, null)).toBe("someday");
  });
  it("buckets same day as today", () => {
    expect(planGroup(now, new Date(2026, 5, 20, 23, 0).getTime())).toBe("today");
  });
  it("buckets later days as upcoming", () => {
    expect(planGroup(now, new Date(2026, 5, 22, 9, 0).getTime())).toBe("upcoming");
  });
});
