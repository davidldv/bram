import { isBriefingIntent, runTurn } from "../src/app/turn";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";
import { createInMemoryLifeStore } from "../src/core/life-store-memory";
import type { LifeStore } from "../src/core/life-store";
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

let counter = 0;
function deps(api: BramApi, store: LifeStore = createInMemoryLifeStore()) {
  return {
    api,
    plans: createMemoryPlanRepository(),
    topics: createMemoryTopicRepository([{ id: "tech", label: "tech", enabled: true }]),
    prefs: createMemoryPreferenceRepository(),
    store,
    notifier: { schedule: async () => {}, scheduleAt: async () => {}, cancel: async () => {} },
    calendar: { listEvents: async () => [] },
    now: new Date(2026, 5, 5, 8, 0).getTime(),
    newId: () => `id-${++counter}`,
  };
}
beforeEach(() => { counter = 0; });

describe("runTurn", () => {
  it("returns a briefing for a greeting", async () => {
    const api: BramApi = { news: jest.fn(async () => []), deleteAccount: jest.fn(async () => {}), chat: jest.fn(async () => "Good morning.") };
    const result = await runTurn(deps(api), "good morning");
    expect(result).toEqual({ kind: "briefing", text: "Good morning." });
  });

  it("stores a fact entity on a 'remember that' utterance without calling the LLM", async () => {
    const store = createInMemoryLifeStore();
    const api: BramApi = { news: jest.fn(async () => []), deleteAccount: jest.fn(async () => {}), chat: jest.fn(async () => "") };
    const result = await runTurn(deps(api, store), "remember that my wife is Ana");
    expect(result).toEqual({ kind: "remember", text: "Got it — I'll remember that." });
    expect((await store.facts()).map((e) => e.name)).toEqual(["my wife is Ana"]);
    expect(api.chat).not.toHaveBeenCalled();
  });

  it("stores typed items from a chat turn, links them, and returns the clean reply", async () => {
    const store = createInMemoryLifeStore();
    const reply = 'Nice! <<FACTS>>[{"type":"person","text":"Mika"},{"type":"event","text":"booked Germany trip with Mika","date":"2026-07"}]';
    const chat = jest.fn().mockResolvedValueOnce("[]").mockResolvedValueOnce(reply);
    const api: BramApi = { news: jest.fn(async () => []), deleteAccount: jest.fn(async () => {}), chat };
    const result = await runTurn(deps(api, store), "we booked our Germany trip");
    expect(result).toEqual({ kind: "chat", text: "Nice!" });
    expect((await store.people()).map((e) => e.name)).toEqual(["Mika"]);
    const mika = (await store.people())[0];
    expect((await store.eventsForEntity(mika.id)).map((e) => e.text)).toEqual(["booked Germany trip with Mika"]);
  });

  it("injects people and goals into the chat system prompt", async () => {
    const store = createInMemoryLifeStore();
    await store.upsertEntity("person", "Mika", { birthday: "10-12" }, 1, () => "p1");
    await store.upsertEntity("goal", "visit Germany", null, 1, () => "g1");
    const chat = jest.fn().mockResolvedValueOnce("[]").mockResolvedValueOnce("Sure.");
    const api: BramApi = { news: jest.fn(async () => []), deleteAccount: jest.fn(async () => {}), chat };
    await runTurn(deps(api, store), "what should I plan");
    const systemPrompt = chat.mock.calls[1][0] as string;
    expect(systemPrompt).toContain("People you know:");
    expect(systemPrompt).toContain("Mika");
    expect(systemPrompt).toContain("visit Germany");
  });

  it("falls back to a clean reply with no items", async () => {
    const store = createInMemoryLifeStore();
    const chat = jest.fn().mockResolvedValueOnce("[]").mockResolvedValueOnce("Just chatting.");
    const api: BramApi = { news: jest.fn(async () => []), deleteAccount: jest.fn(async () => {}), chat };
    const result = await runTurn(deps(api, store), "how are you");
    expect(result).toEqual({ kind: "chat", text: "Just chatting." });
    expect(await store.facts()).toEqual([]);
  });
});
