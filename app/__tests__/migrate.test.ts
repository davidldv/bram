import { migrateMemories } from "../src/core/migrate";
import { createInMemoryLifeStore } from "../src/core/life-store-memory";
import { createInMemoryMemoryRepository, createMemoryPreferenceRepository } from "../src/core/memory-repository";

let counter = 0;
const newId = () => `id-${++counter}`;
beforeEach(() => { counter = 0; });

describe("migrateMemories", () => {
  it("copies legacy memory rows into fact entities once", async () => {
    const store = createInMemoryLifeStore();
    const memories = createInMemoryMemoryRepository([
      { id: "m1", text: "is vegetarian", createdAt: 10 },
      { id: "m2", text: "my wife is Ana", createdAt: 20 },
    ]);
    const prefs = createMemoryPreferenceRepository();

    await migrateMemories({ store, memories, prefs, newId });
    expect((await store.facts()).map((e) => e.name)).toEqual(["is vegetarian", "my wife is Ana"]);
    expect(await prefs.get("life_model_migrated")).toBe("1");
  });

  it("does not run twice", async () => {
    const store = createInMemoryLifeStore();
    const memories = createInMemoryMemoryRepository([{ id: "m1", text: "is vegetarian", createdAt: 10 }]);
    const prefs = createMemoryPreferenceRepository({ life_model_migrated: "1" });

    await migrateMemories({ store, memories, prefs, newId });
    expect(await store.facts()).toEqual([]);
  });

  it("sets the flag even when there are no rows", async () => {
    const store = createInMemoryLifeStore();
    const prefs = createMemoryPreferenceRepository();
    await migrateMemories({ store, memories: createInMemoryMemoryRepository(), prefs, newId });
    expect(await prefs.get("life_model_migrated")).toBe("1");
  });
});
