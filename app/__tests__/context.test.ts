import { tokenize, buildContext, type ContextSnapshot } from "../src/core/context";
import type { Entity, LifeEvent } from "../src/core/types";

function ent(id: string, type: Entity["type"], name: string, attributes: Record<string, unknown> | null = null): Entity {
  return { id, type, name, attributes, lastMentionedAt: 0, createdAt: 0 };
}
function ev(id: string, text: string, occurredAt: number | null = null): LifeEvent {
  return { id, text, occurredAt, createdAt: 0 };
}
const empty: ContextSnapshot = { people: [], goals: [], recentEvents: [], searchHits: [] };

describe("tokenize", () => {
  it("lowercases, drops stopwords and short tokens, dedups", () => {
    expect(tokenize("What should I buy Mika for Mika?")).toEqual(["should", "buy", "mika"]);
  });
});

describe("buildContext", () => {
  it("returns empty string for an empty model", () => {
    expect(buildContext(empty)).toBe("");
  });

  it("always includes people and goals, with attributes", () => {
    const out = buildContext({
      ...empty,
      people: [ent("p1", "person", "Mika", { birthday: "10-12" })],
      goals: [ent("g1", "goal", "visit Germany")],
    });
    expect(out).toContain("People you know:");
    expect(out).toContain("- Mika (birthday 10-12)");
    expect(out).toContain("Your goals:");
    expect(out).toContain("- visit Germany");
  });

  it("renders recent events with a month label", () => {
    const out = buildContext({ ...empty, recentEvents: [ev("v1", "booked trip", new Date(2026, 6, 1).getTime())] });
    expect(out).toContain("Recent in your life:");
    expect(out).toContain("- 2026-07: booked trip");
  });

  it("includes keyword hits not already shown", () => {
    const shown = ent("p1", "person", "Mika");
    const hit = ev("v9", "old gift idea");
    const out = buildContext({ ...empty, people: [shown], searchHits: [shown, hit] });
    expect(out).toContain("Related to what you said:");
    expect(out).toContain("- old gift idea");
    // the already-shown person is not repeated in the related section
    expect(out.split("Mika").length - 1).toBe(1);
  });

  it("caps total lines at 40", () => {
    const people = Array.from({ length: 50 }, (_, i) => ent(`p${i}`, "person", `Person${i}`));
    const out = buildContext({ ...empty, people });
    const lines = out.split("\n").filter((l) => l.startsWith("- "));
    expect(lines.length).toBe(40);
  });
});
