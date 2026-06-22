import { createInMemoryLifeStore } from "../src/core/life-store-memory";

let counter = 0;
const newId = () => `id-${++counter}`;
beforeEach(() => { counter = 0; });

describe("createInMemoryLifeStore", () => {
  it("dedups entities by (type, lower name), bumps lastMentionedAt and merges attributes", async () => {
    const s = createInMemoryLifeStore();
    const a = await s.upsertEntity("person", "Mika", { birthday: "10-12" }, 1, newId);
    const b = await s.upsertEntity("person", "mika", { city: "Berlin" }, 5, newId);
    expect(b.id).toBe(a.id);
    expect(b.lastMentionedAt).toBe(5);
    expect(b.attributes).toEqual({ birthday: "10-12", city: "Berlin" });
    expect((await s.people()).length).toBe(1);
  });

  it("keeps different types with the same name separate", async () => {
    const s = createInMemoryLifeStore();
    await s.upsertEntity("person", "Germany", null, 1, newId);
    await s.upsertEntity("goal", "Germany", null, 1, newId);
    expect((await s.people()).length).toBe(1);
    expect((await s.goals()).length).toBe(1);
  });

  it("lists facts and deletes an entity", async () => {
    const s = createInMemoryLifeStore();
    const f = await s.upsertEntity("fact", "is vegetarian", null, 1, newId);
    expect((await s.facts()).map((e) => e.name)).toEqual(["is vegetarian"]);
    await s.deleteEntity(f.id);
    expect(await s.facts()).toEqual([]);
  });

  it("orders recent events by occurredAt, falling back to createdAt", async () => {
    const s = createInMemoryLifeStore();
    await s.addEvent("older", 100, 1, newId);
    await s.addEvent("newer", 200, 1, newId);
    await s.addEvent("no date", null, 50, newId);
    expect((await s.recentEvents(2)).map((e) => e.text)).toEqual(["newer", "older"]);
  });

  it("links idempotently and finds events for an entity", async () => {
    const s = createInMemoryLifeStore();
    const p = await s.upsertEntity("person", "Mika", null, 1, newId);
    const e = await s.addEvent("trip with Mika", null, 1, newId);
    await s.link(e.id, p.id);
    await s.link(e.id, p.id);
    expect((await s.eventsForEntity(p.id)).map((x) => x.text)).toEqual(["trip with Mika"]);
  });

  it("searches entity names and event texts by token, empty tokens → []", async () => {
    const s = createInMemoryLifeStore();
    await s.upsertEntity("person", "Mika", null, 1, newId);
    await s.addEvent("gift idea", null, 1, newId);
    expect(await s.search([])).toEqual([]);
    const hits = await s.search(["gift"]);
    expect(hits.map((x) => ("text" in x ? x.text : x.name))).toEqual(["gift idea"]);
  });
});
