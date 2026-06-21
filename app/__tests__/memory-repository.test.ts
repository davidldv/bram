import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
  createInMemoryMemoryRepository,
} from "../src/core/memory-repository";
import type { Plan } from "../src/core/types";

function plan(over: Partial<Plan> = {}): Plan {
  return {
    id: "1",
    type: "task",
    title: "thing",
    scheduledAt: null,
    createdAt: 0,
    done: false,
    ...over,
  };
}

describe("memory plan repository", () => {
  it("adds and lists plans", async () => {
    const repo = createMemoryPlanRepository();
    await repo.add(plan({ id: "a" }));
    await repo.add(plan({ id: "b" }));
    const all = await repo.list();
    expect(all.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("lists only plans whose scheduledAt is in [start, end)", async () => {
    const repo = createMemoryPlanRepository([
      plan({ id: "before", scheduledAt: 50 }),
      plan({ id: "in", scheduledAt: 150 }),
      plan({ id: "end-exclusive", scheduledAt: 200 }),
      plan({ id: "none", scheduledAt: null }),
    ]);
    const range = await repo.listForRange(100, 200);
    expect(range.map((p) => p.id)).toEqual(["in"]);
  });

  it("marks a plan done", async () => {
    const repo = createMemoryPlanRepository([plan({ id: "a", done: false })]);
    await repo.markDone("a");
    expect((await repo.list())[0].done).toBe(true);
  });
});

describe("memory preference repository", () => {
  it("returns null for missing keys and stores values", async () => {
    const prefs = createMemoryPreferenceRepository();
    expect(await prefs.get("k")).toBeNull();
    await prefs.set("k", "v");
    expect(await prefs.get("k")).toBe("v");
  });
});

describe("memory topic repository", () => {
  it("lists topics and toggles enabled", async () => {
    const topics = createMemoryTopicRepository([
      { id: "tech", label: "tech", enabled: true },
      { id: "world", label: "world", enabled: false },
    ]);
    await topics.setEnabled("world", true);
    const list = await topics.list();
    expect(list.find((t) => t.id === "world")?.enabled).toBe(true);
  });
});

describe("in-memory memory (facts) repository", () => {
  it("adds, lists, and deletes facts", async () => {
    const repo = createInMemoryMemoryRepository();
    await repo.add({ id: "a", text: "my wife is Ana", createdAt: 1 });
    await repo.add({ id: "b", text: "I take meds at 9", createdAt: 2 });
    expect((await repo.list()).map((m) => m.id)).toEqual(["a", "b"]);
    await repo.delete("a");
    expect((await repo.list()).map((m) => m.id)).toEqual(["b"]);
  });
});
