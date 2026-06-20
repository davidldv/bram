import { capturePlans } from "../src/core/capture-service";
import { createMemoryPlanRepository } from "../src/core/memory-repository";
import type { BramApi } from "../src/core/api";
import type { Notifier } from "../src/notify/notifier";

function fakeApi(reply: string): BramApi {
  return {
    chat: jest.fn(async () => reply),
    news: jest.fn(async () => []),
  };
}

function spyNotifier(): Notifier & { schedule: jest.Mock; cancel: jest.Mock } {
  return { schedule: jest.fn(async () => {}), cancel: jest.fn(async () => {}) };
}

describe("capturePlans", () => {
  it("parses the model reply and stores the plans", async () => {
    const reply = JSON.stringify([{ type: "reminder", title: "gym", scheduledAt: null }]);
    const api = fakeApi(reply);
    const repo = createMemoryPlanRepository();
    let counter = 0;

    const result = await capturePlans(
      { api, repo, notifier: spyNotifier(), now: 1000, newId: () => `id-${++counter}` },
      "remind me to gym"
    );

    expect(result.map((p) => p.title)).toEqual(["gym"]);
    expect((await repo.list()).map((p) => p.title)).toEqual(["gym"]);
  });

  it("sends the utterance as the user message to chat", async () => {
    const api = fakeApi("[]");
    const repo = createMemoryPlanRepository();

    await capturePlans({ api, repo, notifier: spyNotifier(), now: 1000, newId: () => "x" }, "lunch tomorrow");

    const call = (api.chat as jest.Mock).mock.calls[0];
    expect(call[1]).toEqual([{ role: "user", content: "lunch tomorrow" }]);
  });

  it("stores nothing when the model returns an empty array", async () => {
    const api = fakeApi("[]");
    const repo = createMemoryPlanRepository();
    const result = await capturePlans({ api, repo, notifier: spyNotifier(), now: 1000, newId: () => "x" }, "hello");
    expect(result).toEqual([]);
    expect(await repo.list()).toEqual([]);
  });

  it("schedules a notification for a future timed plan", async () => {
    const now = new Date(2026, 5, 20, 8, 0).getTime();
    const future = new Date(2026, 5, 20, 17, 0).toISOString();
    const api = fakeApi(JSON.stringify([{ type: "reminder", title: "call Ana", scheduledAt: future }]));
    const notifier = spyNotifier();
    await capturePlans(
      { api, repo: createMemoryPlanRepository(), notifier, now, newId: () => "id-1" },
      "remind me to call Ana at 5pm"
    );
    expect(notifier.schedule).toHaveBeenCalledTimes(1);
    expect(notifier.schedule.mock.calls[0][0].title).toBe("call Ana");
  });

  it("does not schedule for a timeless or past plan", async () => {
    const now = new Date(2026, 5, 20, 8, 0).getTime();
    const past = new Date(2026, 5, 20, 6, 0).toISOString();
    const api = fakeApi(
      JSON.stringify([
        { type: "task", title: "buy milk", scheduledAt: null },
        { type: "reminder", title: "missed", scheduledAt: past },
      ])
    );
    const notifier = spyNotifier();
    await capturePlans(
      { api, repo: createMemoryPlanRepository(), notifier, now, newId: () => "id-1" },
      "buy milk"
    );
    expect(notifier.schedule).not.toHaveBeenCalled();
  });
});
