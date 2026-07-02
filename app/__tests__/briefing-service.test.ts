import { morningBriefing, dayRange } from "../src/core/briefing-service";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";
import type { BramApi } from "../src/core/api";
import type { Plan, CalendarEvent } from "../src/core/types";
import type { CalendarService } from "../src/calendar/calendar";

const noopCalendar: CalendarService = { listEvents: async () => [] };

function plan(over: Partial<Plan> = {}): Plan {
  return { id: "1", type: "task", title: "thing", scheduledAt: null, createdAt: 0, done: false, ...over };
}

describe("dayRange", () => {
  it("spans local midnight to next midnight", () => {
    const now = new Date(2026, 5, 5, 13, 0).getTime();
    const { startMs, endMs } = dayRange(now);
    expect(startMs).toBe(new Date(2026, 5, 5, 0, 0, 0, 0).getTime());
    expect(endMs).toBe(startMs + 24 * 60 * 60 * 1000);
  });
});

describe("morningBriefing", () => {
  it("requests only enabled topics, briefs on today's plans, returns the reply", async () => {
    const now = new Date(2026, 5, 5, 8, 0).getTime();
    const todayAt = (h: number) => new Date(2026, 5, 5, h, 0).getTime();
    const yesterday = new Date(2026, 5, 4, 9, 0).getTime();

    const api: BramApi = {
      news: jest.fn(async () => [{ title: "N", source: "S", url: "http://a" }]),
      chat: jest.fn(async () => "Good morning."),
      deleteAccount: jest.fn(async () => {}),
    };
    const plans = createMemoryPlanRepository([
      plan({ id: "today", title: "standup", scheduledAt: todayAt(9) }),
      plan({ id: "old", title: "old thing", scheduledAt: yesterday }),
    ]);
    const topics = createMemoryTopicRepository([
      { id: "tech", label: "tech", enabled: true },
      { id: "sports", label: "sports", enabled: false },
    ]);
    const prefs = createMemoryPreferenceRepository();
    const event: CalendarEvent = { id: "e1", title: "dentist", startMs: todayAt(11), endMs: null, allDay: false };
    const calendar: CalendarService = { listEvents: jest.fn(async () => [event]) };

    const reply = await morningBriefing({ api, plans, topics, prefs, calendar, now });

    expect(reply).toBe("Good morning.");
    expect((api.news as jest.Mock).mock.calls[0][0]).toEqual(["tech"]);

    const chatArgs = (api.chat as jest.Mock).mock.calls[0];
    const userContent = chatArgs[1][0].content as string;
    expect(userContent).toContain("standup");
    expect(userContent).not.toContain("old thing");
    expect(userContent).toContain("dentist"); // calendar event reached the prompt
    expect(userContent).toContain("N");
    expect(chatArgs[0]).toContain("Zayn");
  });

  it("skips the news call when no topics are enabled", async () => {
    const now = new Date(2026, 5, 5, 8, 0).getTime();
    const api: BramApi = {
      news: jest.fn(async () => [{ title: "N", source: "S", url: "http://a" }]),
      chat: jest.fn(async () => "Morning."),
      deleteAccount: jest.fn(async () => {}),
    };
    const plans = createMemoryPlanRepository();
    const topics = createMemoryTopicRepository([{ id: "tech", label: "tech", enabled: false }]);
    const prefs = createMemoryPreferenceRepository();

    const reply = await morningBriefing({ api, plans, topics, prefs, calendar: noopCalendar, now });

    expect(reply).toBe("Morning.");
    expect(api.news as jest.Mock).not.toHaveBeenCalled();
    const userContent = (api.chat as jest.Mock).mock.calls[0][1][0].content as string;
    expect(userContent).toContain("(no headlines)");
  });
});
