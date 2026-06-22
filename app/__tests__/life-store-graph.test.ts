import { createInMemoryLifeStore } from "../src/core/life-store-memory";

const now = 1000;

describe("graphEdges", () => {
  it("connects two entities that share an event, ordered a<b, deduped", async () => {
    const store = createInMemoryLifeStore();
    const ana = await store.upsertEntity("person", "Ana", null, now, () => "ana");
    const ben = await store.upsertEntity("person", "Ben", null, now, () => "ben");
    const ev = await store.addEvent("dinner", null, now, () => "ev1");
    await store.link(ev.id, ana.id);
    await store.link(ev.id, ben.id);
    expect(await store.graphEdges()).toEqual([["ana", "ben"]]);
  });

  it("yields no edge for entities that share no event", async () => {
    const store = createInMemoryLifeStore();
    const ana = await store.upsertEntity("person", "Ana", null, now, () => "ana");
    const ben = await store.upsertEntity("person", "Ben", null, now, () => "ben");
    const e1 = await store.addEvent("solo a", null, now, () => "e1");
    const e2 = await store.addEvent("solo b", null, now, () => "e2");
    await store.link(e1.id, ana.id);
    await store.link(e2.id, ben.id);
    expect(await store.graphEdges()).toEqual([]);
  });

  it("ignores entity→entity links (only event from_ids count)", async () => {
    const store = createInMemoryLifeStore();
    const ana = await store.upsertEntity("person", "Ana", null, now, () => "ana");
    const ben = await store.upsertEntity("person", "Ben", null, now, () => "ben");
    await store.link(ana.id, ben.id); // not via an event
    expect(await store.graphEdges()).toEqual([]);
  });
});

describe("entityNeighbors", () => {
  it("returns co-event entities and excludes self and unrelated", async () => {
    const store = createInMemoryLifeStore();
    const ana = await store.upsertEntity("person", "Ana", null, now, () => "ana");
    const ben = await store.upsertEntity("person", "Ben", null, now, () => "ben");
    const cy = await store.upsertEntity("person", "Cy", null, now, () => "cy");
    const ev = await store.addEvent("dinner", null, now, () => "ev1");
    await store.link(ev.id, ana.id);
    await store.link(ev.id, ben.id);
    const names = (await store.entityNeighbors("ana")).map((e) => e.name);
    expect(names).toEqual(["Ben"]);
  });
});

describe("updateEntity", () => {
  it("renames an entity", async () => {
    const store = createInMemoryLifeStore();
    await store.upsertEntity("person", "Anna", null, now, () => "ana");
    const out = await store.updateEntity("ana", "Ana", null);
    expect(out.name).toBe("Ana");
    expect((await store.people())[0].name).toBe("Ana");
  });

  it("throws on a same-type case-insensitive name collision", async () => {
    const store = createInMemoryLifeStore();
    await store.upsertEntity("person", "Ana", null, now, () => "ana");
    await store.upsertEntity("person", "Ben", null, now, () => "ben");
    await expect(store.updateEntity("ben", "ana", null)).rejects.toThrow();
  });

  it("allows the same name across different types", async () => {
    const store = createInMemoryLifeStore();
    await store.upsertEntity("person", "Germany", null, now, () => "p");
    await store.upsertEntity("goal", "Trip", null, now, () => "g");
    const out = await store.updateEntity("g", "Germany", null);
    expect(out.name).toBe("Germany");
  });

  it("throws on unknown id", async () => {
    const store = createInMemoryLifeStore();
    await expect(store.updateEntity("nope", "X", null)).rejects.toThrow();
  });
});

describe("allEntities", () => {
  it("returns entities of every type", async () => {
    const store = createInMemoryLifeStore();
    await store.upsertEntity("person", "Ana", null, now, () => "p");
    await store.upsertEntity("goal", "Trip", null, now, () => "g");
    await store.upsertEntity("fact", "vegetarian", null, now, () => "f");
    expect((await store.allEntities()).map((e) => e.id).sort()).toEqual(["f", "g", "p"]);
  });
});
