# Auto-memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bram silently extracts durable facts and standing preferences from normal chat turns and stores them, with no new LLM call, table, or UI.

**Architecture:** The existing chat LLM call returns its natural spoken reply followed by an optional `<<FACTS>>` sentinel line and a JSON array of fact strings. A pure parser splits reply from facts; the chat branch of `runTurn` stores facts that aren't already known (case-insensitive, capped per turn). Reuses the existing `memory` SQLite table, `MemoryRepository`, `buildRecall` recall injection, and the Settings "What Bram knows" view/delete.

**Tech Stack:** TypeScript, Expo SDK 56 / React Native, Jest, pnpm. App lives in `app/` (own pnpm root).

## Global Constraints

- Local-first privacy: facts stay on device in the existing SQLite `memory` table; only the chat text already sent leaves the device. No new network egress.
- No new LLM call, no new table, no new repository, no new UI — extraction rides the existing chat call.
- Capture scope: durable personal facts + standing preferences only. No transient state/moods/one-offs.
- Silent storage: no inline acknowledgment, no confirmation prompt. Review/delete via existing Settings.
- Per-turn cap: store at most 3 facts per chat turn.
- Dedup: case-insensitive, trimmed comparison against already-known facts. Keep-both on contradiction (no auto-supersede).
- Run all app commands from `app/`: `pnpm test`, `pnpm typecheck`.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 1: `parseChatReply` — split reply from facts

**Files:**
- Modify: `app/src/core/memory.ts`
- Test: `app/__tests__/memory.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export function parseChatReply(raw: string): { reply: string; facts: string[] }`
  - Splits `raw` on the first line equal to `<<FACTS>>` (trimmed).
  - No sentinel → `{ reply: raw.trim(), facts: [] }`.
  - Sentinel present → `reply` = text before it (trimmed); `JSON.parse` the text after.
  - On any parse error, non-array result → `facts: []` (reply still kept).
  - Each fact is coerced: keep only non-empty strings, trimmed.

- [ ] **Step 1: Write the failing tests**

Append to `app/__tests__/memory.test.ts`:

```typescript
import { parseChatReply } from "../src/core/memory";

describe("parseChatReply", () => {
  it("returns reply only when there is no sentinel", () => {
    expect(parseChatReply("Hello there.")).toEqual({ reply: "Hello there.", facts: [] });
  });

  it("splits reply from a facts array", () => {
    const raw = 'Sure, mornings will be light.\n<<FACTS>>\n["prefers light mornings"]';
    expect(parseChatReply(raw)).toEqual({
      reply: "Sure, mornings will be light.",
      facts: ["prefers light mornings"],
    });
  });

  it("yields no facts for an empty array after the sentinel", () => {
    const raw = "Got it.\n<<FACTS>>\n[]";
    expect(parseChatReply(raw)).toEqual({ reply: "Got it.", facts: [] });
  });

  it("keeps the reply and drops facts when the JSON is malformed", () => {
    const raw = "Okay.\n<<FACTS>>\n[not valid json";
    expect(parseChatReply(raw)).toEqual({ reply: "Okay.", facts: [] });
  });

  it("trims facts and drops empty or non-string entries", () => {
    const raw = 'Done.\n<<FACTS>>\n["  is vegetarian  ", "", 5, "works at La Bodega"]';
    expect(parseChatReply(raw)).toEqual({
      reply: "Done.",
      facts: ["is vegetarian", "works at La Bodega"],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && pnpm test -- memory.test.ts`
Expected: FAIL — `parseChatReply is not a function` / not exported.

- [ ] **Step 3: Implement `parseChatReply`**

Add to `app/src/core/memory.ts`:

```typescript
const FACTS_SENTINEL = "<<FACTS>>";

// Splits a chat reply into the spoken text and any facts the model appended
// after a `<<FACTS>>` line. Tolerant: anything unparseable yields no facts and
// the whole text is kept as the reply, so extraction never breaks a conversation.
export function parseChatReply(raw: string): { reply: string; facts: string[] } {
  const lines = raw.split("\n");
  const idx = lines.findIndex((l) => l.trim() === FACTS_SENTINEL);
  if (idx === -1) return { reply: raw.trim(), facts: [] };

  const reply = lines.slice(0, idx).join("\n").trim();
  const rest = lines.slice(idx + 1).join("\n").trim();
  let facts: string[] = [];
  try {
    const parsed = JSON.parse(rest);
    if (Array.isArray(parsed)) {
      facts = parsed
        .filter((f): f is string => typeof f === "string")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
    }
  } catch {
    facts = [];
  }
  return { reply, facts };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && pnpm test -- memory.test.ts`
Expected: PASS (all `parseChatReply` tests plus the existing memory tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/core/memory.ts app/__tests__/memory.test.ts
git commit -m "feat(app): parseChatReply splits chat reply from extracted facts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Extraction instructions in the chat system prompt

**Files:**
- Modify: `app/src/core/memory.ts`
- Modify: `app/src/core/persona.ts`
- Test: `app/__tests__/memory.test.ts`

**Interfaces:**
- Consumes: `buildChatSystemPrompt(name: string, recall?: string): string` (existing, in `persona.ts`).
- Produces: `export function buildExtractionInstructions(): string` in `memory.ts`. `buildChatSystemPrompt` now appends it so every chat call carries the extraction protocol.

- [ ] **Step 1: Write the failing tests**

Append to `app/__tests__/memory.test.ts`:

```typescript
import { buildExtractionInstructions } from "../src/core/memory";

describe("buildExtractionInstructions", () => {
  it("documents the sentinel and the new-facts-only rule", () => {
    const text = buildExtractionInstructions();
    expect(text).toContain("<<FACTS>>");
    expect(text).toMatch(/only.*not already/i);
  });
});
```

In `app/__tests__/persona.test.ts`, add `buildChatSystemPrompt` to the existing import on line 1:

```typescript
import { getPersonaName, setPersonaName, DEFAULT_PERSONA, buildChatSystemPrompt } from "../src/core/persona";
```

Then append a new `describe` block at the end of the file:

```typescript
describe("buildChatSystemPrompt", () => {
  it("includes the fact-extraction protocol", () => {
    const prompt = buildChatSystemPrompt("Bram", "");
    expect(prompt).toContain("<<FACTS>>");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && pnpm test -- memory.test.ts persona.test.ts`
Expected: FAIL — `buildExtractionInstructions is not a function`; persona prompt lacks `<<FACTS>>`.

- [ ] **Step 3: Implement the instructions and wire them in**

Add to `app/src/core/memory.ts`:

```typescript
// Appended to the chat system prompt. Tells the model to surface durable facts
// and standing preferences after its spoken reply, using the FACTS_SENTINEL
// protocol that parseChatReply understands.
export function buildExtractionInstructions(): string {
  return [
    "After your spoken reply, if the user revealed a durable fact about themselves",
    "(identity, relationships, lasting preferences) or a standing preference for how",
    "you should behave, AND it is not already in the list above, append a line",
    `containing exactly ${FACTS_SENTINEL} and then a JSON array of short fact strings.`,
    "Capture at most 3, only genuinely new or changed ones. Skip transient moods,",
    "one-off mentions, and anything already known. If there is nothing new, write",
    `nothing after your reply. Never mention ${FACTS_SENTINEL} or the facts in your`,
    "spoken reply.",
  ].join("\n");
}
```

In `app/src/core/persona.ts`, import and append. Change the top import line and `buildChatSystemPrompt`:

```typescript
import { buildExtractionInstructions } from "./memory";
```

```typescript
export function buildChatSystemPrompt(name: string, recall = ""): string {
  const lines = [
    `You are ${name}, a warm, concise personal voice assistant.`,
    "Replies are spoken aloud, so keep them to 1-3 short sentences.",
    "Use plain text only — no markdown, lists, code, or emoji.",
  ];
  if (recall) lines.push("", recall);
  lines.push("", buildExtractionInstructions());
  return lines.join("\n");
}
```

Note: `persona.ts` importing from `memory.ts` introduces no cycle — `memory.ts` does not import `persona.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && pnpm test -- memory.test.ts persona.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/core/memory.ts app/src/core/persona.ts app/__tests__/memory.test.ts app/__tests__/persona.test.ts
git commit -m "feat(app): append fact-extraction protocol to chat system prompt

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Store extracted facts in the chat turn

**Files:**
- Modify: `app/src/app/turn.ts:74-82` (the chat fallback branch)
- Test: `app/__tests__/turn.test.ts`

**Interfaces:**
- Consumes: `parseChatReply` (Task 1); `buildChatSystemPrompt` (now carries extraction instructions, Task 2); existing `deps.memories: MemoryRepository` with `add({ id, text, createdAt })` and `list()`; `deps.newId`, `deps.now`.
- Produces: chat branch returns `{ kind: "chat", text: reply }` where `reply` is the parsed spoken text (facts stripped), having stored new facts as a side effect.

- [ ] **Step 1: Write the failing tests**

Append to `app/__tests__/turn.test.ts` inside the `describe("runTurn", ...)` block:

```typescript
it("stores new facts emitted by the chat turn and returns the clean reply", async () => {
  const reply = 'Nice to meet your wife.\n<<FACTS>>\n["my wife is Ana"]';
  const chat = jest.fn().mockResolvedValueOnce("[]").mockResolvedValueOnce(reply);
  const api: BramApi = { news: jest.fn(async () => []), chat };
  const d = deps(api);
  const result = await runTurn(d, "my wife is Ana by the way");
  expect(result).toEqual({ kind: "chat", text: "Nice to meet your wife." });
  expect((await d.memories.list()).map((m) => m.text)).toEqual(["my wife is Ana"]);
});

it("skips a fact that duplicates a known one (case-insensitive)", async () => {
  const reply = 'Sure.\n<<FACTS>>\n["My Wife Is Ana"]';
  const chat = jest.fn().mockResolvedValueOnce("[]").mockResolvedValueOnce(reply);
  const api: BramApi = { news: jest.fn(async () => []), chat };
  const d = deps(api);
  await d.memories.add({ id: "m1", text: "my wife is Ana", createdAt: 1 });
  await runTurn(d, "talk about my wife");
  expect((await d.memories.list()).map((m) => m.text)).toEqual(["my wife is Ana"]);
});

it("stores at most 3 facts per turn", async () => {
  const reply = 'Ok.\n<<FACTS>>\n["a","b","c","d"]';
  const chat = jest.fn().mockResolvedValueOnce("[]").mockResolvedValueOnce(reply);
  const api: BramApi = { news: jest.fn(async () => []), chat };
  const d = deps(api);
  await runTurn(d, "lots about me");
  expect((await d.memories.list()).map((m) => m.text)).toEqual(["a", "b", "c"]);
});

it("stores nothing and returns the raw reply when there is no facts block", async () => {
  const chat = jest.fn().mockResolvedValueOnce("[]").mockResolvedValueOnce("Just chatting.");
  const api: BramApi = { news: jest.fn(async () => []), chat };
  const d = deps(api);
  const result = await runTurn(d, "how are you");
  expect(result).toEqual({ kind: "chat", text: "Just chatting." });
  expect(await d.memories.list()).toEqual([]);
});
```

Note: the existing test "falls back to a conversational reply…" sends a plain reply with no sentinel, so `parseChatReply` returns `{ reply: that text, facts: [] }` — it stays green unchanged.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && pnpm test -- turn.test.ts`
Expected: FAIL — new facts are not stored / reply not parsed (sentinel text still present).

- [ ] **Step 3: Implement the chat branch change**

In `app/src/app/turn.ts`, update the import on line 13 to include `parseChatReply`:

```typescript
import { isRememberIntent, stripRememberLead, buildRecall, parseChatReply } from "../core/memory";
```

Replace the chat fallback branch (currently lines 74-82) with:

```typescript
  // Nothing to capture and not a briefing → just talk back as the persona.
  // ponytail: capture-first means 2 LLM calls per chat turn; add an intent
  // classifier (one call) if free-tier rate limits start biting.
  const persona = await getPersonaName(deps.prefs);
  const known = await deps.memories.list();
  const recall = buildRecall(known);
  const raw = await deps.api.chat(buildChatSystemPrompt(persona, recall), [
    { role: "user", content: utterance },
  ]);
  const { reply, facts } = parseChatReply(raw);

  // Silently store genuinely new facts (case-insensitive dedup, max 3/turn).
  const seen = new Set(known.map((m) => m.text.toLowerCase()));
  for (const fact of facts.slice(0, 3)) {
    if (seen.has(fact.toLowerCase())) continue;
    seen.add(fact.toLowerCase());
    await deps.memories.add({ id: deps.newId(), text: fact, createdAt: deps.now });
  }

  return { kind: "chat", text: reply };
```

Note: `deps.newId` returns `"id-1"` in tests for every call, but the in-memory repo keys on insertion, not id, so multiple facts in one turn still all store. (Production `newId` is `expo-crypto randomUUID`, unique per call.)

- [ ] **Step 4: Run the full app test suite + typecheck**

Run: `cd app && pnpm test && pnpm typecheck`
Expected: PASS — all tests green, no type errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/turn.ts app/__tests__/turn.test.ts
git commit -m "feat(app): auto-store facts extracted from chat turns

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Manual on-device verification (after Task 3)

Not a code task — run once on the Pixel_7 emulator dev build (JS-only change, Metro hot-reload, no native rebuild needed):

1. Open the app, go to the Talk tab, say something revealing a durable fact (e.g. "by the way I'm vegetarian").
2. Confirm the spoken reply sounds natural with no `<<FACTS>>` leakage.
3. Go to Settings → "What Bram knows" and confirm the fact appears.
4. Say the same fact again; confirm it is **not** duplicated.
5. Delete it from Settings to confirm cleanup still works.

If facts never appear, check the model is honoring the format: temporarily log `raw` in the chat branch via `__DEV__` and read `adb logcat ReactNativeJS:V '*:S'`, then revert. Free models vary; if one ignores the sentinel reliably, note it and consider a model swap (out of scope for this plan).

---

## Self-Review

- **Spec coverage:** capture scope → prompt instructions (Task 2); piggyback mechanism → single chat call reused (Task 3); silent visibility → no inline ack, reuses Settings (no task needed); dedup/new-only → prompt rule (Task 2) + case-insensitive guard (Task 3); sentinel format + tolerant parse → `parseChatReply` (Task 1); per-turn cap → `.slice(0,3)` (Task 3); error handling → parse tolerance tests (Task 1) + no-block test (Task 3). All spec sections mapped.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `parseChatReply` returns `{ reply, facts }` consistently across Tasks 1 and 3; `buildExtractionInstructions(): string` consistent across Tasks 2; `memories.add`/`list` match existing `MemoryRepository`.
