import { rowToPlan, rowToTopic, rowToEntity, rowToEvent } from "../src/db/mappers";

describe("rowToPlan", () => {
  it("maps a DB row to a Plan (done 1 -> true, scheduled_at preserved)", () => {
    const plan = rowToPlan({
      id: "a",
      type: "reminder",
      title: "gym",
      scheduled_at: 1718000000000,
      created_at: 100,
      done: 1,
    });
    expect(plan).toEqual({
      id: "a",
      type: "reminder",
      title: "gym",
      scheduledAt: 1718000000000,
      createdAt: 100,
      done: true,
    });
  });

  it("maps null scheduled_at and done 0 -> false", () => {
    const plan = rowToPlan({
      id: "b",
      type: "task",
      title: "thing",
      scheduled_at: null,
      created_at: 0,
      done: 0,
    });
    expect(plan.scheduledAt).toBeNull();
    expect(plan.done).toBe(false);
  });
});

describe("rowToTopic", () => {
  it("maps enabled 1 -> true and 0 -> false", () => {
    expect(rowToTopic({ id: "tech", label: "tech", enabled: 1 })).toEqual({
      id: "tech",
      label: "tech",
      enabled: true,
    });
    expect(rowToTopic({ id: "world", label: "world", enabled: 0 }).enabled).toBe(false);
  });
});

describe("rowToEntity", () => {
  it("parses a full row including JSON attributes", () => {
    const e = rowToEntity({
      id: "e1", type: "person", name: "Mika",
      attributes: '{"birthday":"10-12"}', last_mentioned_at: 5, created_at: 2,
    });
    expect(e).toEqual({
      id: "e1", type: "person", name: "Mika",
      attributes: { birthday: "10-12" }, lastMentionedAt: 5, createdAt: 2,
    });
  });

  it("maps null attributes to null", () => {
    const e = rowToEntity({ id: "e2", type: "fact", name: "is vegetarian", attributes: null, last_mentioned_at: 1, created_at: 1 });
    expect(e.attributes).toBeNull();
  });

  it("falls back to null on malformed attributes JSON", () => {
    const e = rowToEntity({ id: "e3", type: "goal", name: "ship game", attributes: "{not json", last_mentioned_at: 1, created_at: 1 });
    expect(e.attributes).toBeNull();
  });
});

describe("rowToEvent", () => {
  it("maps an event row", () => {
    expect(rowToEvent({ id: "v1", text: "booked trip", occurred_at: 100, created_at: 90 })).toEqual({
      id: "v1", text: "booked trip", occurredAt: 100, createdAt: 90,
    });
  });
  it("preserves a null occurred_at", () => {
    expect(rowToEvent({ id: "v2", text: "no date", occurred_at: null, created_at: 1 }).occurredAt).toBeNull();
  });
});
