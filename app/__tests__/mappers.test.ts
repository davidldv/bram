import { rowToPlan, rowToTopic } from "../src/db/mappers";

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
