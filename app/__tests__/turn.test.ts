import { isBriefingIntent, runTurn } from "../src/app/turn";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
  createInMemoryMemoryRepository,
} from "../src/core/memory-repository";
import type { BramApi } from "../src/core/api";

describe("isBriefingIntent", () => {
  it("treats greetings/briefing phrases as briefing", () => {
    expect(isBriefingIntent("good morning")).toBe(true);
    expect(isBriefingIntent("what's on today?")).toBe(true);
    expect(isBriefingIntent("brief me")).toBe(true);
  });
  it("treats other utterances as not briefing", () => {
    expect(isBriefingIntent("remind me to call Ana")).toBe(false);
  });
});

function deps(api: BramApi) {
  return {
    api,
    plans: createMemoryPlanRepository(),
    topics: createMemoryTopicRepository([{ id: "tech", label: "tech", enabled: true }]),
    prefs: createMemoryPreferenceRepository(),
    memories: createInMemoryMemoryRepository(),
    notifier: { schedule: async () => {}, cancel: async () => {} },
    now: new Date(2026, 5, 5, 8, 0).getTime(),
    newId: () => "id-1",
  };
}

describe("runTurn", () => {
  it("returns a briefing for a greeting", async () => {
    const api: BramApi = { news: jest.fn(async () => []), chat: jest.fn(async () => "Good morning.") };
    const result = await runTurn(deps(api), "good morning");
    expect(result).toEqual({ kind: "briefing", text: "Good morning." });
  });

  it("captures and confirms a plan for a non-greeting", async () => {
    const reply = JSON.stringify([{ type: "reminder", title: "gym", scheduledAt: null }]);
    const api: BramApi = { news: jest.fn(async () => []), chat: jest.fn(async () => reply) };
    const d = deps(api);
    const result = await runTurn(d, "remind me to gym");
    expect(result.kind).toBe("capture");
    if (result.kind === "capture") {
      expect(result.count).toBe(1);
      expect(result.text).toContain("gym");
    }
    expect((await d.plans.list()).map((p) => p.title)).toEqual(["gym"]);
  });

  it("falls back to a conversational reply when nothing is captured", async () => {
    const chat = jest
      .fn()
      .mockResolvedValueOnce("[]") // capture attempt finds no plans
      .mockResolvedValueOnce("Doing great — how can I help?"); // chat fallback
    const api: BramApi = { news: jest.fn(async () => []), chat };
    const result = await runTurn(deps(api), "how are you");
    expect(result).toEqual({ kind: "chat", text: "Doing great — how can I help?" });
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it("stores a fact on a 'remember that' utterance without calling the LLM", async () => {
    const api: BramApi = { news: jest.fn(async () => []), chat: jest.fn(async () => "") };
    const d = deps(api);
    const result = await runTurn(d, "remember that my wife is Ana");
    expect(result).toEqual({ kind: "remember", text: "Got it — I'll remember that." });
    expect((await d.memories.list()).map((m) => m.text)).toEqual(["my wife is Ana"]);
    expect(api.chat).not.toHaveBeenCalled();
  });

  it("injects known facts into the chat system prompt", async () => {
    const chat = jest
      .fn()
      .mockResolvedValueOnce("[]") // capture finds nothing
      .mockResolvedValueOnce("Sure thing."); // chat reply
    const api: BramApi = { news: jest.fn(async () => []), chat };
    const d = deps(api);
    await d.memories.add({ id: "m1", text: "my wife is Ana", createdAt: 1 });
    await runTurn(d, "say hi to my wife");
    const chatSystemPrompt = chat.mock.calls[1][0] as string;
    expect(chatSystemPrompt).toContain("Things you know about the user:");
    expect(chatSystemPrompt).toContain("my wife is Ana");
  });
});
