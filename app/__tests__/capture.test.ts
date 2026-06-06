import { buildCaptureSystemPrompt, parseCapturedPlans } from "../src/core/capture";

const deps = { now: 1000, newId: () => "fixed-id" };

describe("buildCaptureSystemPrompt", () => {
  it("mentions JSON array and the current time", () => {
    const prompt = buildCaptureSystemPrompt("2026-06-05T08:00:00.000Z");
    expect(prompt).toContain("JSON array");
    expect(prompt).toContain("2026-06-05T08:00:00.000Z");
  });
});

describe("parseCapturedPlans", () => {
  it("parses a plain JSON array", () => {
    const reply = JSON.stringify([
      { type: "reminder", title: "gym", scheduledAt: "2026-06-05T18:00:00.000Z" },
    ]);
    const plans = parseCapturedPlans(reply, deps);
    expect(plans).toEqual([
      {
        id: "fixed-id",
        type: "reminder",
        title: "gym",
        scheduledAt: Date.parse("2026-06-05T18:00:00.000Z"),
        createdAt: 1000,
        done: false,
      },
    ]);
  });

  it("strips ```json code fences", () => {
    const reply = '```json\n[{"type":"task","title":"call Ana","scheduledAt":null}]\n```';
    const plans = parseCapturedPlans(reply, deps);
    expect(plans).toHaveLength(1);
    expect(plans[0].title).toBe("call Ana");
    expect(plans[0].scheduledAt).toBeNull();
  });

  it("returns [] on invalid JSON", () => {
    expect(parseCapturedPlans("not json", deps)).toEqual([]);
  });

  it("returns [] when the payload is not an array", () => {
    expect(parseCapturedPlans('{"title":"x"}', deps)).toEqual([]);
  });

  it("defaults unknown type to task and bad date to null", () => {
    const reply = JSON.stringify([{ type: "weird", title: "thing", scheduledAt: "nonsense" }]);
    const plans = parseCapturedPlans(reply, deps);
    expect(plans[0].type).toBe("task");
    expect(plans[0].scheduledAt).toBeNull();
  });

  it("skips items with no usable title", () => {
    const reply = JSON.stringify([{ type: "task", title: "  " }, { type: "task", title: "ok" }]);
    const plans = parseCapturedPlans(reply, deps);
    expect(plans.map((p) => p.title)).toEqual(["ok"]);
  });
});
