# Bram App UI + Device Implementation Plan (Plan 2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the tested app core (Plan 2a) into a runnable Bram app: SQLite-backed repositories, native speech (TTS + STT) behind interfaces, a turn controller, three screens, and app wiring — verified on a device.

**Architecture:** Build on `app/src/core/` (unchanged). Add device adapters that implement the existing repository interfaces (expo-sqlite) and new speech interfaces (expo-speech for TTS, expo-speech-recognition for STT). Pure logic (row mappers, the turn controller, the services context) is unit-tested with jest; screens are tested with @testing-library/react-native using injected fake services; native I/O is verified with an explicit on-device checklist. A `ServicesProvider` injects all dependencies so screens never touch native modules directly — that is what makes them testable.

**Tech Stack:** Expo SDK 56, React Native, TypeScript, expo-sqlite, expo-speech, expo-speech-recognition (jamsch), expo-crypto, jest-expo + @testing-library/react-native.

---

## IMPORTANT: Build constraint

`expo-speech-recognition` contains a native module and a config plugin, so the app must run as a **development build** (`npx expo prebuild` then `npx expo run:ios` / `run:android`, or an EAS dev build) — **not Expo Go**. expo-sqlite, expo-speech, and expo-crypto would work in Expo Go, but STT does not. All `npm test` steps below run in Node and need no device; only the on-device checklist (Task 11) needs the dev build.

All commands run from `C:\Users\Alejandro\Dev\bram\app` unless stated. Commit commands run from the repo root `C:\Users\Alejandro\Dev\bram`.

## Package manager: pnpm

This project uses **pnpm** (not npm). The app is its own pnpm project root (`app/pnpm-workspace.yaml`, `app/.npmrc` with `node-linker=hoisted` for Metro). Command mapping used throughout this plan:

- `pnpm test` (run all) / `pnpm test -- __tests__/x.test.ts` (single file)
- `pnpm typecheck`
- `pnpm expo install <pkg>` (version-matched Expo installs)
- `pnpm add -D <pkg>` (dev deps)
- `pnpm exec expo <cmd>` for `prebuild`/`run:ios`/`run:android`
- Commit `pnpm-lock.yaml` (there is no `package-lock.json`)
- pnpm blocks dependency build scripts by default. If install reports `Ignored build scripts`, decide each in `app/pnpm-workspace.yaml` under `allowBuilds:` (`true` to allow, `false` to keep blocked) — do not blanket-approve.

---

## File Structure (this plan)

```
app/
  app.json                         # + expo-speech-recognition plugin & permissions
  App.tsx                          # async services init + screen switch (replaces scaffold default)
  src/
    db/
      schema.ts                    # CREATE TABLE SQL + default topics
      mappers.ts                   # row <-> domain (pure, tested)
      sqlite.ts                    # SqliteDatabase port (subset interface)
      open.ts                      # openBramDatabase: open + migrate + seed (native)
      sqlite-repository.ts         # PlanRepository/PreferenceRepository/TopicRepository over SqliteDatabase (native)
    speech/
      tts.ts                       # Speaker interface + createSpeaker (expo-speech)
      stt.ts                       # VoiceCapture interface + createVoiceCapture (expo-speech-recognition)
    app/
      turn.ts                      # isBriefingIntent + runTurn (pure, tested)
      services.tsx                 # Services type + ServicesProvider + useServices
      build-services.ts            # buildServices(): wires sqlite + speech + api + crypto (native)
      config.ts                    # backend base URL
    screens/
      ConversationScreen.tsx
      TopicsScreen.tsx
      PersonaScreen.tsx
  __tests__/
    mappers.test.ts
    turn.test.ts
    services.test.tsx
    ConversationScreen.test.tsx
    TopicsScreen.test.tsx
    PersonaScreen.test.tsx
```

---

## Task 0: Install native deps + configure permissions + testing-library

**Files:**
- Modify: `app/app.json`, `app/package.json` (via installers)

- [ ] **Step 1: Install Expo native modules (version-matched to SDK 56)**

```bash
pnpm expo install expo-sqlite expo-speech expo-crypto expo-speech-recognition
```

Expected: installs the four packages at SDK-56-compatible versions. If pnpm reports `Ignored build scripts`, decide each in `app/pnpm-workspace.yaml` `allowBuilds:` (see the Package manager note above), then re-run `pnpm install`.

- [ ] **Step 2: Install React Native testing library + renderer**

```bash
pnpm expo install react-test-renderer
pnpm add -D @testing-library/react-native
```

Expected: installs successfully. (`react-test-renderer` must match the project's React version; `expo install` picks the right one.)

- [ ] **Step 3: Add the speech-recognition config plugin and permission strings to `app/app.json`**

Inside the top-level `"expo"` object, add a `"plugins"` array (merge if one already exists):

```json
    "plugins": [
      [
        "expo-speech-recognition",
        {
          "microphonePermission": "Allow Bram to use the microphone to hear you.",
          "speechRecognitionPermission": "Allow Bram to convert your speech to text.",
          "androidSpeechServicePackages": ["com.google.android.googlequicksearchbox"]
        }
      ]
    ]
```

- [ ] **Step 4: Add a placeholder backend URL under `expo.extra` in `app/app.json`**

Inside the `"expo"` object add (merge if `extra` exists):

```json
    "extra": {
      "backendBaseUrl": "http://localhost:3000"
    }
```

(On a physical device this must later become your machine's LAN IP or a deployed URL; localhost only works in a simulator. Not needed for any `npm test`.)

- [ ] **Step 5: Verify the existing suite still passes**

```bash
pnpm test
```

Expected: the 30 Plan-2a tests still pass (installs shouldn't change them).

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml app/app.json
git commit -m "chore(app): add expo-sqlite/speech/crypto/speech-recognition + testing-library"
```

---

## Task 1: DB schema + row mappers

**Files:**
- Create: `app/src/db/schema.ts`, `app/src/db/mappers.ts`
- Test: `app/__tests__/mappers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/mappers.test.ts
```

Expected: FAIL — cannot find module `../src/db/mappers`.

- [ ] **Step 3: Create `app/src/db/mappers.ts`**

```ts
import type { Plan, NewsTopic } from "../core/types";

export interface PlanRow {
  id: string;
  type: string;
  title: string;
  scheduled_at: number | null;
  created_at: number;
  done: number;
}

export function rowToPlan(r: PlanRow): Plan {
  return {
    id: r.id,
    type: r.type as Plan["type"],
    title: r.title,
    scheduledAt: r.scheduled_at,
    createdAt: r.created_at,
    done: r.done === 1,
  };
}

export interface TopicRow {
  id: string;
  label: string;
  enabled: number;
}

export function rowToTopic(r: TopicRow): NewsTopic {
  return { id: r.id, label: r.label, enabled: r.enabled === 1 };
}
```

- [ ] **Step 4: Create `app/src/db/schema.ts`**

```ts
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS plan (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  scheduled_at INTEGER,
  created_at INTEGER NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS preference (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS news_topic (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0
);
`;

export const DEFAULT_TOPICS: { id: string; label: string; enabled: number }[] = [
  { id: "tech", label: "tech", enabled: 1 },
  { id: "world", label: "world", enabled: 1 },
  { id: "business", label: "business", enabled: 0 },
  { id: "science", label: "science", enabled: 0 },
  { id: "sports", label: "sports", enabled: 0 },
];
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- __tests__/mappers.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add app/src/db/schema.ts app/src/db/mappers.ts app/__tests__/mappers.test.ts
git commit -m "feat(app): sqlite schema + pure row mappers"
```

---

## Task 2: SQLite repositories

**Files:**
- Create: `app/src/db/sqlite.ts`, `app/src/db/open.ts`, `app/src/db/sqlite-repository.ts`

This task has no unit test: the repositories are thin wrappers over expo-sqlite (a native module that cannot run in Node/jest). The bug-prone mapping logic is already tested in Task 1; the SQL itself is verified on-device in Task 11. Keep these files minimal.

- [ ] **Step 1: Create `app/src/db/sqlite.ts` (the port we depend on)**

```ts
// Minimal subset of the expo-sqlite database API that our repositories use.
// The object returned by SQLite.openDatabaseAsync satisfies this structurally.
export interface SqliteDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: (string | number | null)[]): Promise<T[]>;
}
```

- [ ] **Step 2: Create `app/src/db/open.ts`**

```ts
import * as SQLite from "expo-sqlite";
import type { SqliteDatabase } from "./sqlite";
import { SCHEMA_SQL, DEFAULT_TOPICS } from "./schema";

export async function openBramDatabase(name = "bram.db"): Promise<SqliteDatabase> {
  const db = (await SQLite.openDatabaseAsync(name)) as unknown as SqliteDatabase;
  await db.execAsync(SCHEMA_SQL);
  await seedDefaultTopics(db);
  return db;
}

async function seedDefaultTopics(db: SqliteDatabase): Promise<void> {
  const existing = await db.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM news_topic"
  );
  if ((existing[0]?.count ?? 0) > 0) return;
  for (const t of DEFAULT_TOPICS) {
    await db.runAsync(
      "INSERT INTO news_topic (id, label, enabled) VALUES (?, ?, ?)",
      [t.id, t.label, t.enabled]
    );
  }
}
```

- [ ] **Step 3: Create `app/src/db/sqlite-repository.ts`**

```ts
import type { Plan, NewsTopic } from "../core/types";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
} from "../core/repository";
import type { SqliteDatabase } from "./sqlite";
import { rowToPlan, rowToTopic, type PlanRow, type TopicRow } from "./mappers";

export function createSqlitePlanRepository(db: SqliteDatabase): PlanRepository {
  return {
    async add(plan: Plan) {
      await db.runAsync(
        "INSERT INTO plan (id, type, title, scheduled_at, created_at, done) VALUES (?, ?, ?, ?, ?, ?)",
        [plan.id, plan.type, plan.title, plan.scheduledAt, plan.createdAt, plan.done ? 1 : 0]
      );
    },
    async list() {
      const rows = await db.getAllAsync<PlanRow>("SELECT * FROM plan ORDER BY created_at ASC");
      return rows.map(rowToPlan);
    },
    async listForRange(startMs: number, endMs: number) {
      const rows = await db.getAllAsync<PlanRow>(
        "SELECT * FROM plan WHERE scheduled_at IS NOT NULL AND scheduled_at >= ? AND scheduled_at < ? ORDER BY scheduled_at ASC",
        [startMs, endMs]
      );
      return rows.map(rowToPlan);
    },
    async markDone(id: string) {
      await db.runAsync("UPDATE plan SET done = 1 WHERE id = ?", [id]);
    },
  };
}

export function createSqlitePreferenceRepository(db: SqliteDatabase): PreferenceRepository {
  return {
    async get(key: string) {
      const rows = await db.getAllAsync<{ value: string }>(
        "SELECT value FROM preference WHERE key = ?",
        [key]
      );
      return rows[0]?.value ?? null;
    },
    async set(key: string, value: string) {
      await db.runAsync(
        "INSERT INTO preference (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, value]
      );
    },
  };
}

export function createSqliteTopicRepository(db: SqliteDatabase): TopicRepository {
  return {
    async list() {
      const rows = await db.getAllAsync<TopicRow>("SELECT * FROM news_topic ORDER BY id ASC");
      return rows.map(rowToTopic);
    },
    async setEnabled(id: string, enabled: boolean) {
      await db.runAsync("UPDATE news_topic SET enabled = ? WHERE id = ?", [enabled ? 1 : 0, id]);
    },
  };
}
```

- [ ] **Step 4: Confirm the project still type-checks and tests pass**

```bash
npm run typecheck
npm test
```

Expected: typecheck clean (the `expo-sqlite` import resolves now that it's installed); all existing tests still pass. No new tests added in this task.

- [ ] **Step 5: Commit**

```bash
git add app/src/db/sqlite.ts app/src/db/open.ts app/src/db/sqlite-repository.ts
git commit -m "feat(app): sqlite repositories implementing core interfaces"
```

---

## Task 3: Text-to-speech adapter

**Files:**
- Create: `app/src/speech/tts.ts`

Native wrapper (expo-speech) — verified on device (Task 11). The `Speaker` interface is what screens depend on, so they stay testable with fakes.

- [ ] **Step 1: Create `app/src/speech/tts.ts`**

```ts
import * as Speech from "expo-speech";

export interface Speaker {
  speak(text: string): Promise<void>;
  stop(): void;
}

export function createSpeaker(): Speaker {
  return {
    speak(text: string) {
      return new Promise<void>((resolve) => {
        Speech.speak(text, {
          onDone: () => resolve(),
          onError: () => resolve(),
        });
      });
    },
    stop() {
      Speech.stop();
    },
  };
}
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/src/speech/tts.ts
git commit -m "feat(app): expo-speech TTS adapter behind Speaker interface"
```

---

## Task 4: Speech-to-text adapter

**Files:**
- Create: `app/src/speech/stt.ts`

Native wrapper (expo-speech-recognition) — verified on device (Task 11). Screens depend only on the `VoiceCapture` interface.

- [ ] **Step 1: Create `app/src/speech/stt.ts`**

```ts
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";

export interface VoiceCapture {
  // Requests permission, starts listening, and invokes onResult once with the
  // final transcript (empty string if nothing was recognized).
  start(onResult: (transcript: string) => void): Promise<void>;
  stop(): void;
}

export function createVoiceCapture(): VoiceCapture {
  let resultSub: { remove: () => void } | undefined;
  let endSub: { remove: () => void } | undefined;
  let delivered = false;
  let lastTranscript = "";

  const cleanup = () => {
    resultSub?.remove();
    endSub?.remove();
    resultSub = undefined;
    endSub = undefined;
  };

  return {
    async start(onResult) {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) throw new Error("microphone/speech permission denied");

      delivered = false;
      lastTranscript = "";

      resultSub = ExpoSpeechRecognitionModule.addListener(
        "result",
        (event: ExpoSpeechRecognitionResultEvent) => {
          lastTranscript = event.results[0]?.transcript ?? "";
          if (event.isFinal && !delivered) {
            delivered = true;
            cleanup();
            onResult(lastTranscript);
          }
        }
      );

      endSub = ExpoSpeechRecognitionModule.addListener("end", () => {
        if (!delivered) {
          delivered = true;
          cleanup();
          onResult(lastTranscript);
        }
      });

      ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: false, continuous: false });
    },
    stop() {
      ExpoSpeechRecognitionModule.stop();
    },
  };
}
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: clean. If the named type `ExpoSpeechRecognitionResultEvent` is not exported by the installed version, replace its import and the parameter annotation with an inline type `{ isFinal: boolean; results: { transcript: string }[] }` and re-run typecheck. Report if you had to do this.

- [ ] **Step 3: Commit**

```bash
git add app/src/speech/stt.ts
git commit -m "feat(app): expo-speech-recognition STT adapter behind VoiceCapture interface"
```

---

## Task 5: Turn controller

**Files:**
- Create: `app/src/app/turn.ts`
- Test: `app/__tests__/turn.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { isBriefingIntent, runTurn } from "../src/app/turn";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
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

  it("reports when nothing was captured", async () => {
    const api: BramApi = { news: jest.fn(async () => []), chat: jest.fn(async () => "[]") };
    const result = await runTurn(deps(api), "blah blah");
    expect(result).toEqual({ kind: "capture", text: "I didn't catch anything to save.", count: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/turn.test.ts
```

Expected: FAIL — cannot find module `../src/app/turn`.

- [ ] **Step 3: Create `app/src/app/turn.ts`**

```ts
import type { BramApi } from "../core/api";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
} from "../core/repository";
import { morningBriefing } from "../core/briefing-service";
import { capturePlans } from "../core/capture-service";

export type TurnResult =
  | { kind: "briefing"; text: string }
  | { kind: "capture"; text: string; count: number };

export function isBriefingIntent(utterance: string): boolean {
  const u = utterance.toLowerCase();
  return /\b(good morning|morning|brief|briefing|what'?s (on|up|today)|my day|today)\b/.test(u);
}

export async function runTurn(
  deps: {
    api: BramApi;
    plans: PlanRepository;
    topics: TopicRepository;
    prefs: PreferenceRepository;
    now: number;
    newId: () => string;
  },
  utterance: string
): Promise<TurnResult> {
  if (isBriefingIntent(utterance)) {
    const text = await morningBriefing({
      api: deps.api,
      plans: deps.plans,
      topics: deps.topics,
      prefs: deps.prefs,
      now: deps.now,
    });
    return { kind: "briefing", text };
  }

  const captured = await capturePlans(
    { api: deps.api, repo: deps.plans, now: deps.now, newId: deps.newId },
    utterance
  );
  const text = captured.length
    ? `Got it — ${captured.map((p) => p.title).join(", ")}.`
    : "I didn't catch anything to save.";
  return { kind: "capture", text, count: captured.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/turn.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/app/turn.ts app/__tests__/turn.test.ts
git commit -m "feat(app): turn controller routing briefing vs capture"
```

---

## Task 6: Services context + provider

**Files:**
- Create: `app/src/app/services.tsx`
- Test: `app/__tests__/services.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from "react";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { ServicesProvider, useServices, type Services } from "../src/app/services";
import { createBramApi } from "../src/core/api";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";

function fakeServices(): Services {
  return {
    api: createBramApi({ baseUrl: "http://x", fetchFn: (async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch }),
    plans: createMemoryPlanRepository(),
    topics: createMemoryTopicRepository([]),
    prefs: createMemoryPreferenceRepository(),
    speaker: { speak: async () => {}, stop: () => {} },
    voice: { start: async () => {}, stop: () => {} },
    newId: () => "x",
    now: () => 0,
  };
}

function Probe() {
  const s = useServices();
  return <Text>{typeof s.newId === "function" ? "has-services" : "no"}</Text>;
}

describe("ServicesProvider", () => {
  it("exposes services to children via useServices", () => {
    render(
      <ServicesProvider services={fakeServices()}>
        <Probe />
      </ServicesProvider>
    );
    expect(screen.getByText("has-services")).toBeTruthy();
  });

  it("throws when used outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ServicesProvider missing/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/services.test.tsx
```

Expected: FAIL — cannot find module `../src/app/services`.

- [ ] **Step 3: Create `app/src/app/services.tsx`**

```tsx
import React, { createContext, useContext } from "react";
import type { BramApi } from "../core/api";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
} from "../core/repository";
import type { Speaker } from "../speech/tts";
import type { VoiceCapture } from "../speech/stt";

export interface Services {
  api: BramApi;
  plans: PlanRepository;
  topics: TopicRepository;
  prefs: PreferenceRepository;
  speaker: Speaker;
  voice: VoiceCapture;
  newId: () => string;
  now: () => number;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: React.ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error("ServicesProvider missing");
  return s;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/services.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/app/services.tsx app/__tests__/services.test.tsx
git commit -m "feat(app): services context + provider for dependency injection"
```

---

## Task 7: Conversation screen

**Files:**
- Create: `app/src/screens/ConversationScreen.tsx`
- Test: `app/__tests__/ConversationScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ConversationScreen } from "../src/screens/ConversationScreen";
import { ServicesProvider, type Services } from "../src/app/services";
import { createBramApi } from "../src/core/api";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function servicesWithReply(reply: string, transcript: string): { services: Services; spoken: string[] } {
  const spoken: string[] = [];
  const fetchFn = (async () => jsonResponse({ reply })) as unknown as typeof fetch;
  return {
    spoken,
    services: {
      api: createBramApi({ baseUrl: "http://x", fetchFn }),
      plans: createMemoryPlanRepository(),
      topics: createMemoryTopicRepository([]),
      prefs: createMemoryPreferenceRepository(),
      speaker: { speak: async (t: string) => { spoken.push(t); }, stop: () => {} },
      voice: { start: async (onResult: (t: string) => void) => { onResult(transcript); }, stop: () => {} },
      newId: () => "id-1",
      now: () => new Date(2026, 5, 5, 8, 0).getTime(),
    },
  };
}

describe("ConversationScreen", () => {
  it("shows the briefing reply and speaks it after the user talks", async () => {
    const { services, spoken } = servicesWithReply("Good morning, David.", "good morning");
    render(
      <ServicesProvider services={services}>
        <ConversationScreen />
      </ServicesProvider>
    );

    fireEvent.press(screen.getByText("Talk"));

    await waitFor(() => expect(screen.getByText("Good morning, David.")).toBeTruthy());
    expect(spoken).toContain("Good morning, David.");
    expect(screen.getByText("You: good morning")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/ConversationScreen.test.tsx
```

Expected: FAIL — cannot find module `../src/screens/ConversationScreen`.

- [ ] **Step 3: Create `app/src/screens/ConversationScreen.tsx`**

```tsx
import React, { useState } from "react";
import { View, Text, Button, ScrollView } from "react-native";
import { useServices } from "../app/services";
import { runTurn } from "../app/turn";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export function ConversationScreen() {
  const s = useServices();
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  const onTalk = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await s.voice.start(async (transcript) => {
        if (!transcript) {
          setBusy(false);
          return;
        }
        setMessages((m) => [...m, { role: "user", text: transcript }]);
        try {
          const result = await runTurn(
            { api: s.api, plans: s.plans, topics: s.topics, prefs: s.prefs, now: s.now(), newId: s.newId },
            transcript
          );
          setMessages((m) => [...m, { role: "assistant", text: result.text }]);
          await s.speaker.speak(result.text);
        } catch {
          setMessages((m) => [...m, { role: "assistant", text: "Something went wrong reaching the server." }]);
        } finally {
          setBusy(false);
        }
      });
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Sorry, I couldn't hear you." }]);
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <ScrollView style={{ flex: 1 }}>
        {messages.map((m, i) => (
          <Text key={i} style={{ marginVertical: 4 }}>
            {m.role === "user" ? "You: " : ""}
            {m.text}
          </Text>
        ))}
      </ScrollView>
      <Button title={busy ? "Listening…" : "Talk"} onPress={onTalk} disabled={busy} />
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/ConversationScreen.test.tsx
```

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/ConversationScreen.tsx app/__tests__/ConversationScreen.test.tsx
git commit -m "feat(app): conversation screen (tap-to-talk -> turn -> speak)"
```

---

## Task 8: Topics screen

**Files:**
- Create: `app/src/screens/TopicsScreen.tsx`
- Test: `app/__tests__/TopicsScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { TopicsScreen } from "../src/screens/TopicsScreen";
import { ServicesProvider, type Services } from "../src/app/services";
import { createBramApi } from "../src/core/api";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";
import type { TopicRepository } from "../src/core/repository";

function servicesWith(topics: TopicRepository): Services {
  return {
    api: createBramApi({ baseUrl: "http://x" }),
    plans: createMemoryPlanRepository(),
    topics,
    prefs: createMemoryPreferenceRepository(),
    speaker: { speak: async () => {}, stop: () => {} },
    voice: { start: async () => {}, stop: () => {} },
    newId: () => "x",
    now: () => 0,
  };
}

describe("TopicsScreen", () => {
  it("lists topics and toggles enabled state", async () => {
    const topics = createMemoryTopicRepository([
      { id: "tech", label: "tech", enabled: true },
      { id: "world", label: "world", enabled: false },
    ]);
    render(
      <ServicesProvider services={servicesWith(topics)}>
        <TopicsScreen />
      </ServicesProvider>
    );

    await waitFor(() => expect(screen.getByText("world")).toBeTruthy());

    fireEvent(screen.getByLabelText("toggle world"), "valueChange", true);

    await waitFor(async () => {
      const list = await topics.list();
      expect(list.find((t) => t.id === "world")?.enabled).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/TopicsScreen.test.tsx
```

Expected: FAIL — cannot find module `../src/screens/TopicsScreen`.

- [ ] **Step 3: Create `app/src/screens/TopicsScreen.tsx`**

```tsx
import React, { useEffect, useState } from "react";
import { View, Text, Switch } from "react-native";
import { useServices } from "../app/services";
import type { NewsTopic } from "../core/types";

export function TopicsScreen() {
  const s = useServices();
  const [topics, setTopics] = useState<NewsTopic[]>([]);

  useEffect(() => {
    s.topics.list().then(setTopics);
  }, [s]);

  const toggle = async (t: NewsTopic) => {
    await s.topics.setEnabled(t.id, !t.enabled);
    setTopics(await s.topics.list());
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>News topics</Text>
      {topics.map((t) => (
        <View
          key={t.id}
          style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}
        >
          <Text>{t.label}</Text>
          <Switch
            value={t.enabled}
            onValueChange={() => toggle(t)}
            accessibilityLabel={`toggle ${t.label}`}
          />
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/TopicsScreen.test.tsx
```

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/TopicsScreen.tsx app/__tests__/TopicsScreen.test.tsx
git commit -m "feat(app): topics screen with enable toggles"
```

---

## Task 9: Persona screen

**Files:**
- Create: `app/src/screens/PersonaScreen.tsx`
- Test: `app/__tests__/PersonaScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { PersonaScreen } from "../src/screens/PersonaScreen";
import { ServicesProvider, type Services } from "../src/app/services";
import { createBramApi } from "../src/core/api";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";
import { getPersonaName } from "../src/core/persona";
import type { PreferenceRepository } from "../src/core/repository";

function servicesWith(prefs: PreferenceRepository): Services {
  return {
    api: createBramApi({ baseUrl: "http://x" }),
    plans: createMemoryPlanRepository(),
    topics: createMemoryTopicRepository([]),
    prefs,
    speaker: { speak: async () => {}, stop: () => {} },
    voice: { start: async () => {}, stop: () => {} },
    newId: () => "x",
    now: () => 0,
  };
}

describe("PersonaScreen", () => {
  it("shows the default name and saves a new one", async () => {
    const prefs = createMemoryPreferenceRepository();
    render(
      <ServicesProvider services={servicesWith(prefs)}>
        <PersonaScreen />
      </ServicesProvider>
    );

    await waitFor(() => expect(screen.getByText("Current: Zayn")).toBeTruthy());

    fireEvent.changeText(screen.getByLabelText("persona name"), "Otto");
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => expect(screen.getByText("Current: Otto")).toBeTruthy());
    expect(await getPersonaName(prefs)).toBe("Otto");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/PersonaScreen.test.tsx
```

Expected: FAIL — cannot find module `../src/screens/PersonaScreen`.

- [ ] **Step 3: Create `app/src/screens/PersonaScreen.tsx`**

```tsx
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button } from "react-native";
import { useServices } from "../app/services";
import { getPersonaName, setPersonaName } from "../core/persona";

export function PersonaScreen() {
  const s = useServices();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    getPersonaName(s.prefs).then((n) => {
      setName(n);
      setSaved(n);
    });
  }, [s]);

  const save = async () => {
    await setPersonaName(s.prefs, name);
    setSaved(await getPersonaName(s.prefs));
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>Assistant name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        accessibilityLabel="persona name"
        style={{ borderWidth: 1, padding: 8, marginBottom: 12 }}
      />
      <Button title="Save" onPress={save} />
      <Text style={{ marginTop: 12 }}>Current: {saved}</Text>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- __tests__/PersonaScreen.test.tsx
```

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/PersonaScreen.tsx app/__tests__/PersonaScreen.test.tsx
git commit -m "feat(app): persona rename screen"
```

---

## Task 10: App wiring (config, build-services, App.tsx)

**Files:**
- Create: `app/src/app/config.ts`, `app/src/app/build-services.ts`
- Modify: `app/App.tsx`

No new unit test (this is the native composition root, verified on device in Task 11). `config.ts` is trivial and exercised on device.

- [ ] **Step 1: Create `app/src/app/config.ts`**

```ts
import Constants from "expo-constants";

export function getBackendBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { backendBaseUrl?: string } | undefined;
  return extra?.backendBaseUrl ?? "http://localhost:3000";
}
```

- [ ] **Step 2: Create `app/src/app/build-services.ts`**

```ts
import * as Crypto from "expo-crypto";
import { createBramApi } from "../core/api";
import {
  createSqlitePlanRepository,
  createSqlitePreferenceRepository,
  createSqliteTopicRepository,
} from "../db/sqlite-repository";
import { openBramDatabase } from "../db/open";
import { createSpeaker } from "../speech/tts";
import { createVoiceCapture } from "../speech/stt";
import { getBackendBaseUrl } from "./config";
import type { Services } from "./services";

export async function buildServices(): Promise<Services> {
  const db = await openBramDatabase();
  return {
    api: createBramApi({ baseUrl: getBackendBaseUrl() }),
    plans: createSqlitePlanRepository(db),
    topics: createSqliteTopicRepository(db),
    prefs: createSqlitePreferenceRepository(db),
    speaker: createSpeaker(),
    voice: createVoiceCapture(),
    newId: () => Crypto.randomUUID(),
    now: () => Date.now(),
  };
}
```

- [ ] **Step 3: Replace `app/App.tsx` with the composition root**

```tsx
import React, { useEffect, useState } from "react";
import { View, Text, Button, SafeAreaView, ActivityIndicator } from "react-native";
import { ServicesProvider, type Services } from "./src/app/services";
import { buildServices } from "./src/app/build-services";
import { ConversationScreen } from "./src/screens/ConversationScreen";
import { TopicsScreen } from "./src/screens/TopicsScreen";
import { PersonaScreen } from "./src/screens/PersonaScreen";

type Tab = "talk" | "topics" | "name";

export default function App() {
  const [services, setServices] = useState<Services | null>(null);
  const [tab, setTab] = useState<Tab>("talk");

  useEffect(() => {
    buildServices().then(setServices);
  }, []);

  if (!services) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text>Starting Bram…</Text>
      </SafeAreaView>
    );
  }

  return (
    <ServicesProvider services={services}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {tab === "talk" && <ConversationScreen />}
          {tab === "topics" && <TopicsScreen />}
          {tab === "name" && <PersonaScreen />}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-around", padding: 8 }}>
          <Button title="Talk" onPress={() => setTab("talk")} />
          <Button title="Topics" onPress={() => setTab("topics")} />
          <Button title="Name" onPress={() => setTab("name")} />
        </View>
      </SafeAreaView>
    </ServicesProvider>
  );
}
```

- [ ] **Step 4: Type-check and run the full suite**

```bash
npm run typecheck
npm test
```

Expected: typecheck clean; all tests pass (mappers, turn, services, three screens, plus the Plan-2a core suites).

- [ ] **Step 5: Commit**

```bash
git add app/src/app/config.ts app/src/app/build-services.ts app/App.tsx
git commit -m "feat(app): composition root wiring sqlite + speech + api into screens"
```

---

## Task 11: On-device verification (manual)

No code. This task verifies the native pieces that cannot run in jest. Record the result of each check.

- [ ] **Step 1: Start the backend proxy**

From repo root, with a real `.env` (ANTHROPIC_API_KEY, NEWS_API_KEY): `npm run dev`. Confirm `curl localhost:3000/health` → `{"ok":true}`.

- [ ] **Step 2: Point the app at the backend**

In `app/app.json`, set `expo.extra.backendBaseUrl` to a URL the device can reach: `http://localhost:3000` for an iOS simulator, or `http://<your-LAN-IP>:3000` for a physical device on the same network. (Do not commit a personal IP — revert before committing, or use an env-specific config.)

- [ ] **Step 3: Create a development build (required for STT)**

```bash
cd app
pnpm exec expo prebuild
pnpm exec expo run:ios   # or: pnpm exec expo run:android
```

Expected: the app builds and launches on a simulator/device. (Expo Go will NOT work because of expo-speech-recognition.)

- [ ] **Step 4: Verify SQLite persistence**

On the Topics screen, toggle a topic off. Fully close and reopen the app. Confirm the toggle state persisted. On the Name screen, change the assistant name, reopen, confirm it persisted.

- [ ] **Step 5: Verify capture (STT + storage)**

On the Talk screen, tap Talk, grant the mic/speech permission, and say "remind me to call Ana at 6". Confirm the transcript appears as "You: …" and the assistant confirms ("Got it — …").

- [ ] **Step 6: Verify briefing (TTS + news + plans)**

Tap Talk and say "good morning". Confirm the assistant returns a spoken briefing that mentions the plan you captured and (if topics are enabled and the news key is valid) headlines. Confirm audio plays through the speaker.

- [ ] **Step 7: Record results**

Note any failures (permission denial, no audio, empty transcript, network errors to the backend) and file follow-ups. If all six checks pass, the MVP loop works end-to-end.

---

## Self-Review

**Spec coverage (spec §5.1, §6, §7, §8):**
- §6 data model persisted → Tasks 1–2 (schema, mappers, sqlite repos).
- §5.1 local store on device, persona config, context assembler → Tasks 2 (sqlite), 9 (persona screen), 5/6 (turn + services).
- §7.1 briefing flow end-to-end → Tasks 5 (runTurn briefing branch) + 7 (screen) + 11 step 6.
- §7.2 capture flow end-to-end → Tasks 5 (capture branch) + 7 (screen) + 11 step 5.
- §5.1 voice in/out, tap-to-talk, no wake word → Tasks 3 (TTS), 4 (STT, tap-driven `start`), 7 (Talk button).
- §8 personal data stays on device (SQLite), text-only egress (API client sends text; STT runs via device recognizer) → Tasks 2, 4. Note: by default the device speech recognizer may use a network service; `requiresOnDeviceRecognition` can be set true in `stt.ts` for strict on-device, at the cost of availability — a deliberate follow-up, not MVP-blocking.

**Out of scope (future, spec §11):** encrypted sync/paid tier, personalized news, cloud speech option, proactive notifications, wake word.

**Placeholder scan:** none — every code step has complete code; every native-only task states why it has no jest test and is covered by Task 11.

**Type consistency:** `Services` fields (`api`, `plans`, `topics`, `prefs`, `speaker`, `voice`, `newId`, `now`) are used identically across Tasks 6–10 and all three screen tests. `Speaker.speak/stop`, `VoiceCapture.start(onResult)/stop`, `runTurn` deps (`now: number`, `newId: () => string`) match their callers. `SqliteDatabase` (execAsync/runAsync/getAllAsync) is used consistently by `open.ts` and `sqlite-repository.ts`. Repository methods match the Plan-2a interfaces (`add`/`list`/`listForRange`/`markDone`, `get`/`set`, `list`/`setEnabled`).

**Risk note for execution:** @testing-library/react-native + react-test-renderer must match React 19 / RN 0.85. If a screen test errors on renderer/React version mismatch, install the versions the error names (via `npx expo install react-test-renderer`) and re-run — do not downgrade React. If `expo-speech-recognition` does not export `ExpoSpeechRecognitionResultEvent`, use the inline event type noted in Task 4 Step 2.
```
