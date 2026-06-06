import { buildBriefingPrompt } from "../src/core/briefing";
import type { Headline, Plan } from "../src/core/types";

function plan(over: Partial<Plan> = {}): Plan {
  return { id: "1", type: "task", title: "thing", scheduledAt: null, createdAt: 0, done: false, ...over };
}

describe("buildBriefingPrompt", () => {
  it("names the persona in the system prompt", () => {
    const { system } = buildBriefingPrompt({ persona: "Zayn", dateLabel: "Fri", plans: [], headlines: [] });
    expect(system).toContain("Zayn");
  });

  it("includes plans and headlines in the user message", () => {
    const headlines: Headline[] = [{ title: "Big News", source: "Wire", url: "http://a" }];
    const { messages } = buildBriefingPrompt({
      persona: "Zayn",
      dateLabel: "Fri Jun 5 2026",
      plans: [plan({ title: "call Ana" })],
      headlines,
    });
    const content = messages[0].content;
    expect(messages[0].role).toBe("user");
    expect(content).toContain("Fri Jun 5 2026");
    expect(content).toContain("call Ana");
    expect(content).toContain("Big News");
    expect(content).toContain("Wire");
  });

  it("shows empty-state lines when there are no plans or headlines", () => {
    const { messages } = buildBriefingPrompt({ persona: "Zayn", dateLabel: "Fri", plans: [], headlines: [] });
    expect(messages[0].content).toContain("(no plans today)");
    expect(messages[0].content).toContain("(no headlines)");
  });

  it("prefixes a scheduled plan with its local HH:MM", () => {
    const scheduledAt = new Date(2026, 5, 5, 9, 30).getTime();
    const d = new Date(scheduledAt);
    const expected = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} standup`;
    const { messages } = buildBriefingPrompt({
      persona: "Zayn",
      dateLabel: "Fri",
      plans: [plan({ title: "standup", scheduledAt })],
      headlines: [],
    });
    expect(messages[0].content).toContain(expected);
  });
});
