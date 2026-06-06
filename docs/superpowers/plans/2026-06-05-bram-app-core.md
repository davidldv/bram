# Bram App Core Implementation Plan (Plan 2a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the framework-agnostic, fully unit-tested core of the Bram mobile app — data repositories, the backend API client, and the capture/briefing/persona logic — inside an Expo + TypeScript project.

**Architecture:** A new Expo (blank-typescript) app lives in `app/` (the backend proxy stays at the repo root). All business logic lives in `app/src/core/` as pure TypeScript with no React Native or Expo imports, so it runs under plain `jest`/`jest-expo`. Persistence and the network are behind injectable interfaces (`PlanRepository`, `PreferenceRepository`, `TopicRepository`, `BramApi`); this plan ships in-memory implementations used by tests (and usable for dev/preview). Device-bound implementations (expo-sqlite, native speech) and all UI come in Plan 2b.

**Tech Stack:** Expo SDK, React Native, TypeScript, jest-expo + jest for tests.

---

## Project Structure (this plan)

The app is a second npm project under `app/`, separate from the root backend.

```
bram/
  (root: backend proxy — unchanged)
  app/
    package.json            # Expo app + jest config
    tsconfig.json
    App.tsx                 # scaffold default (UI comes in 2b)
    src/
      core/
        types.ts            # domain types (Plan, Headline, NewsTopic, ChatMessage)
        repository.ts       # repository interfaces
        memory-repository.ts# in-memory repo implementations (testable)
        api.ts              # BramApi client (calls backend /chat, /news)
        capture.ts          # buildCaptureSystemPrompt + parseCapturedPlans (pure)
        briefing.ts         # buildBriefingPrompt (pure)
        persona.ts          # getPersonaName / setPersonaName
        capture-service.ts  # capturePlans: api + repo + parser
        briefing-service.ts # morningBriefing: api + repos + builder
    __tests__/
      memory-repository.test.ts
      api.test.ts
      persona.test.ts
      capture.test.ts
      briefing.test.ts
      capture-service.test.ts
      briefing-service.test.ts
```

**All commands below run from `C:\Users\Alejandro\Dev\bram\app` unless stated otherwise.**

---

## Task 0: Scaffold Expo app + jest

**Files:**
- Create: `app/` (Expo blank-typescript project), `app/package.json` (jest config added), `app/jest.setup.ts`, `app/__tests__/smoke.test.ts`

- [ ] **Step 1: Scaffold the Expo app**

From the repo root `C:\Users\Alejandro\Dev\bram`, run:

```bash
npx create-expo-app@latest app --template blank-typescript
```

Expected: creates `app/` with `App.tsx`, `app.json`, `package.json`, `tsconfig.json`, and installs dependencies.

- [ ] **Step 2: Remove any nested git repo create-expo-app may have created**

```bash
rm -rf app/.git
```

(The app must be part of the existing `bram` repo, not a nested one. `rm -rf` is safe here — it only removes a nested `.git` if present.)

- [ ] **Step 3: Add test dependencies**

From `app/`:

```bash
npm install --save-dev jest-expo jest @types/jest
```

Expected: installs successfully.

- [ ] **Step 4: Add jest config + test script to `app/package.json`**

Add a `"test"` script and a `"jest"` block. The `scripts` and a new top-level `jest` key should read:

```json
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest",
    "typecheck": "tsc --noEmit"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["<rootDir>/jest.setup.ts"],
    "testMatch": ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))"
    ]
  }
```

Keep any other existing fields in `package.json` as-is; only merge in the `test`/`typecheck` scripts and the `jest` block.

- [ ] **Step 5: Create `app/jest.setup.ts`**

```ts
// Reserved for global test setup (none required yet).
export {};
```

- [ ] **Step 6: Create `app/__tests__/smoke.test.ts`**

```ts
describe("toolchain", () => {
  it("runs typescript tests", () => {
    const sum = (a: number, b: number): number => a + b;
    expect(sum(2, 3)).toBe(5);
  });
});
```

- [ ] **Step 7: Ensure `@types/jest` is picked up — add to `app/tsconfig.json`**

Open `app/tsconfig.json`. It extends `expo/tsconfig.base`. Add a `compilerOptions.types` entry so `describe/it/expect/jest` type-check. The file should look like:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": ["jest"]
  }
}
```

(If the scaffold's tsconfig already has `compilerOptions`, merge `"types": ["jest"]` into it and keep `"strict": true`.)

- [ ] **Step 8: Run the smoke test**

```bash
npm test -- __tests__/smoke.test.ts
```

Expected: 1 test passes.

- [ ] **Step 9: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 10: Commit**

From repo root:

```bash
git add app/.gitignore app/package.json app/package-lock.json app/tsconfig.json app/app.json app/App.tsx app/jest.setup.ts app/__tests__/smoke.test.ts app/assets app/babel.config.js
git commit -m "chore: scaffold expo app with jest"
```

(If `git add` reports a path that does not exist, e.g. no `babel.config.js`, drop that path and re-run. Then `git status` should show no untracked app files except `node_modules`, which `app/.gitignore` already excludes.)

---

## Task 1: Domain types + in-memory repositories

**Files:**
- Create: `app/src/core/types.ts`, `app/src/core/repository.ts`, `app/src/core/memory-repository.ts`
- Test: `app/__tests__/memory-repository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/memory-repository.test.ts
```

Expected: FAIL — cannot find module `../src/core/memory-repository`.

- [ ] **Step 3: Create `app/src/core/types.ts`**

```ts
export type PlanType = "reminder" | "event" | "task";

export interface Plan {
  id: string;
  type: PlanType;
  title: string;
  scheduledAt: number | null;
  createdAt: number;
  done: boolean;
}

export interface Headline {
  title: string;
  source: string;
  url: string;
}

export interface NewsTopic {
  id: string;
  label: string;
  enabled: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
```

- [ ] **Step 4: Create `app/src/core/repository.ts`**

```ts
import type { Plan, NewsTopic } from "./types";

export interface PlanRepository {
  add(plan: Plan): Promise<void>;
  list(): Promise<Plan[]>;
  listForRange(startMs: number, endMs: number): Promise<Plan[]>;
  markDone(id: string): Promise<void>;
}

export interface PreferenceRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface TopicRepository {
  list(): Promise<NewsTopic[]>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
}
```

- [ ] **Step 5: Create `app/src/core/memory-repository.ts`**

```ts
import type { Plan, NewsTopic } from "./types";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
} from "./repository";

export function createMemoryPlanRepository(seed: Plan[] = []): PlanRepository {
  const plans: Plan[] = [...seed];
  return {
    async add(plan) {
      plans.push(plan);
    },
    async list() {
      return [...plans];
    },
    async listForRange(startMs, endMs) {
      return plans.filter(
        (p) => p.scheduledAt !== null && p.scheduledAt >= startMs && p.scheduledAt < endMs
      );
    },
    async markDone(id) {
      const p = plans.find((x) => x.id === id);
      if (p) p.done = true;
    },
  };
}

export function createMemoryPreferenceRepository(
  seed: Record<string, string> = {}
): PreferenceRepository {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    async get(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async set(key, value) {
      store.set(key, value);
    },
  };
}

export function createMemoryTopicRepository(seed: NewsTopic[]): TopicRepository {
  const topics: NewsTopic[] = [...seed];
  return {
    async list() {
      return [...topics];
    },
    async setEnabled(id, enabled) {
      const t = topics.find((x) => x.id === id);
      if (t) t.enabled = enabled;
    },
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm test -- __tests__/memory-repository.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add app/src/core/types.ts app/src/core/repository.ts app/src/core/memory-repository.ts app/__tests__/memory-repository.test.ts
git commit -m "feat(app): domain types + in-memory repositories"
```

---

## Task 2: Backend API client

**Files:**
- Create: `app/src/core/api.ts`
- Test: `app/__tests__/api.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { createBramApi } from "../src/core/api";

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("createBramApi", () => {
  it("POSTs /chat and returns the reply", async () => {
    const fetchFn = jest.fn(async () => fakeResponse({ reply: "hi there" }));
    const api = createBramApi({ baseUrl: "http://host/", fetchFn: fetchFn as unknown as typeof fetch });

    const reply = await api.chat("be brief", [{ role: "user", content: "hi" }]);

    expect(reply).toBe("hi there");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://host/chat");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      system: "be brief",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("POSTs /news and returns headlines", async () => {
    const headlines = [{ title: "T", source: "S", url: "http://a" }];
    const fetchFn = jest.fn(async () => fakeResponse({ headlines }));
    const api = createBramApi({ baseUrl: "http://host", fetchFn: fetchFn as unknown as typeof fetch });

    const result = await api.news(["tech"]);

    expect(result).toEqual(headlines);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://host/news");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ topics: ["tech"] });
  });

  it("throws when chat returns non-ok", async () => {
    const fetchFn = jest.fn(async () => fakeResponse({}, false, 502));
    const api = createBramApi({ baseUrl: "http://host", fetchFn: fetchFn as unknown as typeof fetch });
    await expect(api.chat("s", [])).rejects.toThrow(/chat failed: 502/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/api.test.ts
```

Expected: FAIL — cannot find module `../src/core/api`.

- [ ] **Step 3: Create `app/src/core/api.ts`**

```ts
import type { ChatMessage, Headline } from "./types";

export interface BramApi {
  chat(system: string, messages: ChatMessage[]): Promise<string>;
  news(topics: string[]): Promise<Headline[]>;
}

export function createBramApi(opts: {
  baseUrl: string;
  fetchFn?: typeof fetch;
}): BramApi {
  const fetchFn = opts.fetchFn ?? fetch;
  const base = opts.baseUrl.replace(/\/$/, "");
  const postJson = async (path: string, payload: unknown): Promise<Response> =>
    fetchFn(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  return {
    async chat(system, messages) {
      const res = await postJson("/chat", { system, messages });
      if (!res.ok) throw new Error(`chat failed: ${res.status}`);
      const data = (await res.json()) as { reply: string };
      return data.reply;
    },
    async news(topics) {
      const res = await postJson("/news", { topics });
      if (!res.ok) throw new Error(`news failed: ${res.status}`);
      const data = (await res.json()) as { headlines: Headline[] };
      return data.headlines;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/api.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/core/api.ts app/__tests__/api.test.ts
git commit -m "feat(app): backend API client for /chat and /news"
```

---

## Task 3: Persona service

**Files:**
- Create: `app/src/core/persona.ts`
- Test: `app/__tests__/persona.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { getPersonaName, setPersonaName, DEFAULT_PERSONA } from "../src/core/persona";
import { createMemoryPreferenceRepository } from "../src/core/memory-repository";

describe("persona", () => {
  it("defaults to Zayn when unset", async () => {
    const prefs = createMemoryPreferenceRepository();
    expect(DEFAULT_PERSONA).toBe("Zayn");
    expect(await getPersonaName(prefs)).toBe("Zayn");
  });

  it("returns the stored name", async () => {
    const prefs = createMemoryPreferenceRepository();
    await setPersonaName(prefs, "Bram");
    expect(await getPersonaName(prefs)).toBe("Bram");
  });

  it("trims input and falls back to default when blank", async () => {
    const prefs = createMemoryPreferenceRepository();
    await setPersonaName(prefs, "   ");
    expect(await getPersonaName(prefs)).toBe("Zayn");
    await setPersonaName(prefs, "  Otto  ");
    expect(await getPersonaName(prefs)).toBe("Otto");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/persona.test.ts
```

Expected: FAIL — cannot find module `../src/core/persona`.

- [ ] **Step 3: Create `app/src/core/persona.ts`**

```ts
import type { PreferenceRepository } from "./repository";

export const PERSONA_KEY = "persona_name";
export const DEFAULT_PERSONA = "Zayn";

export async function getPersonaName(prefs: PreferenceRepository): Promise<string> {
  const v = await prefs.get(PERSONA_KEY);
  return v ?? DEFAULT_PERSONA;
}

export async function setPersonaName(
  prefs: PreferenceRepository,
  name: string
): Promise<void> {
  await prefs.set(PERSONA_KEY, name.trim() || DEFAULT_PERSONA);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/persona.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/core/persona.ts app/__tests__/persona.test.ts
git commit -m "feat(app): persona name service with Zayn default"
```

---

## Task 4: Capture parser

**Files:**
- Create: `app/src/core/capture.ts`
- Test: `app/__tests__/capture.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/capture.test.ts
```

Expected: FAIL — cannot find module `../src/core/capture`.

- [ ] **Step 3: Create `app/src/core/capture.ts`**

```ts
import type { Plan, PlanType } from "./types";

export function buildCaptureSystemPrompt(nowIso: string): string {
  return [
    "You extract plans from the user's message.",
    `The current time is ${nowIso}.`,
    "Return ONLY a JSON array (no prose, no code fences).",
    'Each item: {"type": "reminder"|"event"|"task", "title": string, "scheduledAt": string|null}.',
    "scheduledAt is an ISO 8601 datetime, or null if no time is given.",
    "If there are no plans, return [].",
  ].join("\n");
}

interface RawItem {
  type?: string;
  title?: string;
  scheduledAt?: string | null;
}

const VALID_TYPES: PlanType[] = ["reminder", "event", "task"];

export function parseCapturedPlans(
  reply: string,
  deps: { now: number; newId: () => string }
): Plan[] {
  const text = stripFences(reply).trim();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const plans: Plan[] = [];
  for (const item of raw as RawItem[]) {
    if (!item || typeof item.title !== "string" || item.title.trim() === "") continue;
    const type = VALID_TYPES.includes(item.type as PlanType)
      ? (item.type as PlanType)
      : "task";
    let scheduledAt: number | null = null;
    if (typeof item.scheduledAt === "string") {
      const ms = Date.parse(item.scheduledAt);
      scheduledAt = Number.isNaN(ms) ? null : ms;
    }
    plans.push({
      id: deps.newId(),
      type,
      title: item.title.trim(),
      scheduledAt,
      createdAt: deps.now,
      done: false,
    });
  }
  return plans;
}

function stripFences(text: string): string {
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m);
  return m ? m[1] : text;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/capture.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/core/capture.ts app/__tests__/capture.test.ts
git commit -m "feat(app): capture prompt + tolerant plan parser"
```

---

## Task 5: Briefing prompt builder

**Files:**
- Create: `app/src/core/briefing.ts`
- Test: `app/__tests__/briefing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildBriefingPrompt } from "../src/core/briefing";
import type { Headline, Plan } from "../src/core/types";

function plan(over: Partial<Plan> = {}): Plan {
  return { id: "1", type: "task", title: "thing", scheduledAt: null, createdAt: 0, done: false, ...over };
}

describe("buildBriefingPrompt", () => {
  it("names the persona in the system prompt", () => {
    const { system } = buildBriefingPrompt({ persona: "Zayn", dateLabel: "Fri", plans: [], headlines: [] });
    expect(system).toContain("Zayn");
  });

  it("includes plans and headlines in the user message", () => {
    const headlines: Headline[] = [{ title: "Big News", source: "Wire", url: "http://a" }];
    const { messages } = buildBriefingPrompt({
      persona: "Zayn",
      dateLabel: "Fri Jun 5 2026",
      plans: [plan({ title: "call Ana" })],
      headlines,
    });
    const content = messages[0].content;
    expect(messages[0].role).toBe("user");
    expect(content).toContain("Fri Jun 5 2026");
    expect(content).toContain("call Ana");
    expect(content).toContain("Big News");
    expect(content).toContain("Wire");
  });

  it("shows empty-state lines when there are no plans or headlines", () => {
    const { messages } = buildBriefingPrompt({ persona: "Zayn", dateLabel: "Fri", plans: [], headlines: [] });
    expect(messages[0].content).toContain("(no plans today)");
    expect(messages[0].content).toContain("(no headlines)");
  });

  it("prefixes a scheduled plan with its local HH:MM", () => {
    const scheduledAt = new Date(2026, 5, 5, 9, 30).getTime();
    const d = new Date(scheduledAt);
    const expected = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} standup`;
    const { messages } = buildBriefingPrompt({
      persona: "Zayn",
      dateLabel: "Fri",
      plans: [plan({ title: "standup", scheduledAt })],
      headlines: [],
    });
    expect(messages[0].content).toContain(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/briefing.test.ts
```

Expected: FAIL — cannot find module `../src/core/briefing`.

- [ ] **Step 3: Create `app/src/core/briefing.ts`**

```ts
import type { ChatMessage, Headline, Plan } from "./types";

export function buildBriefingPrompt(input: {
  persona: string;
  dateLabel: string;
  plans: Plan[];
  headlines: Headline[];
}): { system: string; messages: ChatMessage[] } {
  const system = [
    `You are ${input.persona}, a warm, concise personal assistant.`,
    "Give a short spoken morning briefing.",
    "Cover, in order: a one-line greeting, today's plans, then the headlines.",
    "Keep it natural and brief — this will be read aloud.",
  ].join("\n");

  const planLines = input.plans.length
    ? input.plans.map((p) => `- ${formatPlan(p)}`).join("\n")
    : "- (no plans today)";
  const newsLines = input.headlines.length
    ? input.headlines.map((h) => `- ${h.title} (${h.source})`).join("\n")
    : "- (no headlines)";

  const content = [
    `Date: ${input.dateLabel}`,
    "",
    "Today's plans:",
    planLines,
    "",
    "Headlines:",
    newsLines,
  ].join("\n");

  return { system, messages: [{ role: "user", content }] };
}

function formatPlan(p: Plan): string {
  if (p.scheduledAt === null) return p.title;
  const t = new Date(p.scheduledAt);
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  return `${hh}:${mm} ${p.title}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/briefing.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/core/briefing.ts app/__tests__/briefing.test.ts
git commit -m "feat(app): morning briefing prompt builder"
```

---

## Task 6: Capture service

**Files:**
- Create: `app/src/core/capture-service.ts`
- Test: `app/__tests__/capture-service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { capturePlans } from "../src/core/capture-service";
import { createMemoryPlanRepository } from "../src/core/memory-repository";
import type { BramApi } from "../src/core/api";

function fakeApi(reply: string): BramApi {
  return {
    chat: jest.fn(async () => reply),
    news: jest.fn(async () => []),
  };
}

describe("capturePlans", () => {
  it("parses the model reply and stores the plans", async () => {
    const reply = JSON.stringify([{ type: "reminder", title: "gym", scheduledAt: null }]);
    const api = fakeApi(reply);
    const repo = createMemoryPlanRepository();
    let counter = 0;

    const result = await capturePlans(
      { api, repo, now: 1000, newId: () => `id-${++counter}` },
      "remind me to gym"
    );

    expect(result.map((p) => p.title)).toEqual(["gym"]);
    expect((await repo.list()).map((p) => p.title)).toEqual(["gym"]);
  });

  it("sends the utterance as the user message to chat", async () => {
    const api = fakeApi("[]");
    const repo = createMemoryPlanRepository();

    await capturePlans({ api, repo, now: 1000, newId: () => "x" }, "lunch tomorrow");

    const call = (api.chat as jest.Mock).mock.calls[0];
    expect(call[1]).toEqual([{ role: "user", content: "lunch tomorrow" }]);
  });

  it("stores nothing when the model returns an empty array", async () => {
    const api = fakeApi("[]");
    const repo = createMemoryPlanRepository();
    const result = await capturePlans({ api, repo, now: 1000, newId: () => "x" }, "hello");
    expect(result).toEqual([]);
    expect(await repo.list()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/capture-service.test.ts
```

Expected: FAIL — cannot find module `../src/core/capture-service`.

- [ ] **Step 3: Create `app/src/core/capture-service.ts`**

```ts
import type { BramApi } from "./api";
import type { PlanRepository } from "./repository";
import { buildCaptureSystemPrompt, parseCapturedPlans } from "./capture";
import type { Plan } from "./types";

export async function capturePlans(
  deps: { api: BramApi; repo: PlanRepository; now: number; newId: () => string },
  utterance: string
): Promise<Plan[]> {
  const system = buildCaptureSystemPrompt(new Date(deps.now).toISOString());
  const reply = await deps.api.chat(system, [{ role: "user", content: utterance }]);
  const plans = parseCapturedPlans(reply, { now: deps.now, newId: deps.newId });
  for (const plan of plans) {
    await deps.repo.add(plan);
  }
  return plans;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/capture-service.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/core/capture-service.ts app/__tests__/capture-service.test.ts
git commit -m "feat(app): capture service wiring api + repo + parser"
```

---

## Task 7: Briefing service

**Files:**
- Create: `app/src/core/briefing-service.ts`
- Test: `app/__tests__/briefing-service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { morningBriefing, dayRange } from "../src/core/briefing-service";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";
import type { BramApi } from "../src/core/api";
import type { Plan } from "../src/core/types";

function plan(over: Partial<Plan> = {}): Plan {
  return { id: "1", type: "task", title: "thing", scheduledAt: null, createdAt: 0, done: false, ...over };
}

describe("dayRange", () => {
  it("spans local midnight to next midnight", () => {
    const now = new Date(2026, 5, 5, 13, 0).getTime();
    const { startMs, endMs } = dayRange(now);
    expect(startMs).toBe(new Date(2026, 5, 5, 0, 0, 0, 0).getTime());
    expect(endMs).toBe(startMs + 24 * 60 * 60 * 1000);
  });
});

describe("morningBriefing", () => {
  it("requests only enabled topics, briefs on today's plans, returns the reply", async () => {
    const now = new Date(2026, 5, 5, 8, 0).getTime();
    const todayAt = (h: number) => new Date(2026, 5, 5, h, 0).getTime();
    const yesterday = new Date(2026, 5, 4, 9, 0).getTime();

    const api: BramApi = {
      news: jest.fn(async () => [{ title: "N", source: "S", url: "http://a" }]),
      chat: jest.fn(async () => "Good morning."),
    };
    const plans = createMemoryPlanRepository([
      plan({ id: "today", title: "standup", scheduledAt: todayAt(9) }),
      plan({ id: "old", title: "old thing", scheduledAt: yesterday }),
    ]);
    const topics = createMemoryTopicRepository([
      { id: "tech", label: "tech", enabled: true },
      { id: "sports", label: "sports", enabled: false },
    ]);
    const prefs = createMemoryPreferenceRepository();

    const reply = await morningBriefing({ api, plans, topics, prefs, now });

    expect(reply).toBe("Good morning.");
    expect((api.news as jest.Mock).mock.calls[0][0]).toEqual(["tech"]);

    const chatArgs = (api.chat as jest.Mock).mock.calls[0];
    const userContent = chatArgs[1][0].content as string;
    expect(userContent).toContain("standup");
    expect(userContent).not.toContain("old thing");
    expect(userContent).toContain("N");
    expect(chatArgs[0]).toContain("Zayn"); // default persona in system prompt
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/briefing-service.test.ts
```

Expected: FAIL — cannot find module `../src/core/briefing-service`.

- [ ] **Step 3: Create `app/src/core/briefing-service.ts`**

```ts
import type { BramApi } from "./api";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
} from "./repository";
import { buildBriefingPrompt } from "./briefing";
import { getPersonaName } from "./persona";

export function dayRange(now: number): { startMs: number; endMs: number } {
  const d = new Date(now);
  const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

export async function morningBriefing(deps: {
  api: BramApi;
  plans: PlanRepository;
  topics: TopicRepository;
  prefs: PreferenceRepository;
  now: number;
}): Promise<string> {
  const enabledTopics = (await deps.topics.list())
    .filter((t) => t.enabled)
    .map((t) => t.label);
  const headlines = await deps.api.news(enabledTopics);

  const { startMs, endMs } = dayRange(deps.now);
  const plans = await deps.plans.listForRange(startMs, endMs);

  const persona = await getPersonaName(deps.prefs);
  const dateLabel = new Date(deps.now).toDateString();

  const { system, messages } = buildBriefingPrompt({ persona, dateLabel, plans, headlines });
  return deps.api.chat(system, messages);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/briefing-service.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite + typecheck**

```bash
npm test
npm run typecheck
```

Expected: all tests pass (smoke + 6 core suites); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add app/src/core/briefing-service.ts app/__tests__/briefing-service.test.ts
git commit -m "feat(app): morning briefing service over repos + api"
```

---

## Self-Review

**Spec coverage (spec §5.1, §6, §7):**
- §6 data model (Plan/NewsTopic/preference) → Task 1 `types.ts` + repositories.
- §5.1 context assembler, persona config (default "Zayn") → Tasks 5 (briefing builder), 6/7 (services), 3 (persona).
- §7.1 briefing flow (gather plans + enabled topics → news → assemble → chat) → Task 7 `morningBriefing`.
- §7.2 capture flow (utterance → chat extraction → structured items → store) → Tasks 4 (parser) + 6 (service).
- §5.1 local store interface → Task 1 repository interfaces + in-memory impls.

**Deferred to Plan 2b (correctly out of scope here):** the Expo UI (conversation screen, tap-to-talk, topics settings, persona rename screen), native STT/TTS speech adapter, the expo-sqlite implementations of the three repository interfaces, app dependency wiring, and on-device end-to-end verification. The in-memory repositories built here are the test doubles (and dev stand-ins) for the sqlite implementations 2b will add behind the same interfaces.

**Placeholder scan:** none — every code step contains complete code; every run step has an exact command and expected result.

**Type consistency:** `Plan{id,type,title,scheduledAt,createdAt,done}`, `Headline{title,source,url}`, `NewsTopic{id,label,enabled}`, `ChatMessage{role,content}` are used identically across tasks. `PlanRepository.listForRange(startMs,endMs)` matches its `morningBriefing` caller. `BramApi.chat(system,messages)`/`news(topics)` match the api client and both services. `capturePlans`/`morningBriefing`/`getPersonaName`/`setPersonaName`/`parseCapturedPlans`/`buildCaptureSystemPrompt`/`buildBriefingPrompt`/`dayRange` signatures are consistent between definition and use.

**Note for execution:** `parseCapturedPlans` and `capturePlans` take an injected `newId: () => string`. Plan 2b's wiring will supply a real id generator (e.g. `expo-crypto`'s `randomUUID`); tests here inject deterministic ids.
