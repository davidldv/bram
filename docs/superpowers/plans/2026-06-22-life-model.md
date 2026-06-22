# Life-model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bram's flat fact list with a structured life-model — entities (person/goal/fact), events, and links — built from chat, with relevant retrieval into the prompt.

**Architecture:** Three additive SQLite tables behind one `LifeStore` seam. The chat call emits typed items over the existing `<<FACTS>>` channel (tolerant, degrades to facts); code derives event→entity links by name match; `buildContext` injects people + goals + recent events + keyword matches (capped) instead of dumping everything. Existing `memory` rows migrate to `entity(type='fact')` once.

**Tech Stack:** TypeScript, Expo SDK 56 / React Native, expo-sqlite, Jest, pnpm. App in `app/` (own pnpm root) — run all commands from `app/`.

## Global Constraints

- Local-first: everything in on-device SQLite. No new network egress, no new dependency.
- Entity types are exactly `"person" | "goal" | "fact"`. Events attach to entities.
- Extraction piggybacks the existing chat call — NO extra LLM call. Tolerant: unknown/missing type → `fact`; bad JSON → reply kept, no items; never break the conversation.
- Per-turn extraction cap: at most 5 items.
- Linking is deterministic in code (whole-word, case-insensitive name match) — the model never emits links.
- Retrieval cap: 40 total lines, filled people → goals → recent → keyword.
- Entity dedup: by `(type, lower(name))`; bump `last_mentioned_at`; merge attributes.
- SQLite repo/store impls are NOT unit-tested (expo-sqlite is native, unavailable in Jest) — they mirror the in-memory impl's contract and are verified on-device. In-memory impls carry the test coverage. This matches the existing codebase.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Tests: `pnpm test`; types: `pnpm typecheck`, both from `app/`.

---

### Task 1: Schema, types, and row mappers

**Files:**
- Modify: `app/src/db/schema.ts`
- Modify: `app/src/core/types.ts`
- Modify: `app/src/db/mappers.ts`
- Test: `app/__tests__/mappers.test.ts` (create)

**Interfaces:**
- Produces: `EntityType`, `Entity`, `LifeEvent`, `ExtractedItem` (types); `EntityRow`, `EventRow`, `rowToEntity`, `rowToEvent` (mappers); three new tables in `SCHEMA_SQL`.

- [ ] **Step 1: Add the tables to `SCHEMA_SQL`**

In `app/src/db/schema.ts`, append inside the template string (after the `memory` table, before the closing backtick):

```sql
CREATE TABLE IF NOT EXISTS entity (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  attributes TEXT,
  last_mentioned_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  occurred_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS link (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id)
);
```

- [ ] **Step 2: Add the types**

In `app/src/core/types.ts`, append:

```typescript
export type EntityType = "person" | "goal" | "fact";

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  attributes: Record<string, unknown> | null;
  lastMentionedAt: number;
  createdAt: number;
}

export interface LifeEvent {
  id: string;
  text: string;
  occurredAt: number | null;
  createdAt: number;
}

// Parsed-but-not-yet-stored extraction items.
export type ExtractedItem =
  | { kind: "entity"; type: EntityType; text: string; attributes?: Record<string, unknown> }
  | { kind: "event"; text: string; date: string | null };
```

- [ ] **Step 3: Write the failing mapper tests**

Create `app/__tests__/mappers.test.ts`:

```typescript
import { rowToEntity, rowToEvent } from "../src/db/mappers";

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
```

- [ ] **Step 4: Run to verify it fails**

Run: `pnpm test -- mappers.test.ts`
Expected: FAIL — `rowToEntity` / `rowToEvent` not exported.

- [ ] **Step 5: Implement the mappers**

In `app/src/db/mappers.ts`, update the import line and append:

```typescript
import type { Plan, NewsTopic, Memory, Entity, LifeEvent } from "../core/types";
```

```typescript
export interface EntityRow {
  id: string;
  type: string;
  name: string;
  attributes: string | null;
  last_mentioned_at: number;
  created_at: number;
}

export function rowToEntity(r: EntityRow): Entity {
  let attributes: Record<string, unknown> | null = null;
  if (r.attributes) {
    try { attributes = JSON.parse(r.attributes); } catch { attributes = null; }
  }
  return {
    id: r.id,
    type: r.type as Entity["type"],
    name: r.name,
    attributes,
    lastMentionedAt: r.last_mentioned_at,
    createdAt: r.created_at,
  };
}

export interface EventRow {
  id: string;
  text: string;
  occurred_at: number | null;
  created_at: number;
}

export function rowToEvent(r: EventRow): LifeEvent {
  return { id: r.id, text: r.text, occurredAt: r.occurred_at, createdAt: r.created_at };
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm test -- mappers.test.ts && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add app/src/db/schema.ts app/src/core/types.ts app/src/db/mappers.ts app/__tests__/mappers.test.ts
git commit -m "feat(app): life-model schema, types, and row mappers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Typed extraction parser

**Files:**
- Modify: `app/src/core/memory.ts`
- Test: `app/__tests__/memory.test.ts`

**Interfaces:**
- Consumes: `ExtractedItem`, `EntityType` (Task 1).
- Produces: `parseChatReply(raw): { reply: string; items: ExtractedItem[] }` (CHANGED return shape — was `{reply, facts}`); `parseRoughDate(s): number | null`; rewritten `buildExtractionInstructions(): string`.

- [ ] **Step 1: Update the failing tests**

In `app/__tests__/memory.test.ts`, replace the entire `describe("parseChatReply", …)` block and the `describe("buildExtractionInstructions", …)` block with:

```typescript
import { parseRoughDate } from "../src/core/memory";

describe("parseChatReply", () => {
  it("returns reply only when there is no sentinel", () => {
    expect(parseChatReply("Hello there.")).toEqual({ reply: "Hello there.", items: [] });
  });

  it("treats a plain string item as a fact entity (back-compat)", () => {
    const raw = 'Sure.\n<<FACTS>>\n["is vegetarian"]';
    expect(parseChatReply(raw)).toEqual({
      reply: "Sure.",
      items: [{ kind: "entity", type: "fact", text: "is vegetarian" }],
    });
  });

  it("parses typed person / goal / event objects from an inline sentinel", () => {
    const raw = 'Got it. <<FACTS>>[{"type":"person","text":"Mika"},{"type":"goal","text":"visit Germany"},{"type":"event","text":"booked Germany trip","date":"2026-07"}]';
    expect(parseChatReply(raw)).toEqual({
      reply: "Got it.",
      items: [
        { kind: "entity", type: "person", text: "Mika" },
        { kind: "entity", type: "goal", text: "visit Germany" },
        { kind: "event", text: "booked Germany trip", date: "2026-07" },
      ],
    });
  });

  it("keeps person attributes when present", () => {
    const raw = 'Ok. <<FACTS>>[{"type":"person","text":"Mika","attributes":{"birthday":"10-12"}}]';
    expect(parseChatReply(raw).items).toEqual([
      { kind: "entity", type: "person", text: "Mika", attributes: { birthday: "10-12" } },
    ]);
  });

  it("demotes missing or unknown type to a fact", () => {
    const raw = 'Hi. <<FACTS>>[{"text":"likes sushi"},{"type":"pet","text":"has a dog"}]';
    expect(parseChatReply(raw).items).toEqual([
      { kind: "entity", type: "fact", text: "likes sushi" },
      { kind: "entity", type: "fact", text: "has a dog" },
    ]);
  });

  it("treats an event with no date as date null", () => {
    const raw = 'Ok. <<FACTS>>[{"type":"event","text":"got a new job"}]';
    expect(parseChatReply(raw).items).toEqual([{ kind: "event", text: "got a new job", date: null }]);
  });

  it("drops items with no usable text and trims text", () => {
    const raw = 'Done. <<FACTS>>[{"type":"person","text":"  Ana  "},{"type":"fact","text":""},5]';
    expect(parseChatReply(raw).items).toEqual([{ kind: "entity", type: "person", text: "Ana" }]);
  });

  it("keeps the reply and yields no items on malformed JSON", () => {
    expect(parseChatReply("Okay. <<FACTS>>[not json")).toEqual({ reply: "Okay.", items: [] });
  });

  it("caps at 5 items per turn", () => {
    const raw = 'Ok. <<FACTS>>[{"type":"fact","text":"a"},{"type":"fact","text":"b"},{"type":"fact","text":"c"},{"type":"fact","text":"d"},{"type":"fact","text":"e"},{"type":"fact","text":"f"}]';
    expect(parseChatReply(raw).items.map((i) => (i.kind === "entity" ? i.text : ""))).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("parseRoughDate", () => {
  it("parses YYYY-MM to the first of that month", () => {
    expect(parseRoughDate("2026-07")).toBe(new Date(2026, 6, 1).getTime());
  });
  it("parses YYYY-MM-DD", () => {
    expect(parseRoughDate("2026-07-12")).toBe(new Date(2026, 6, 12).getTime());
  });
  it("returns null for null, empty, or garbage", () => {
    expect(parseRoughDate(null)).toBeNull();
    expect(parseRoughDate("")).toBeNull();
    expect(parseRoughDate("next week")).toBeNull();
    expect(parseRoughDate("2026-13")).toBeNull();
  });
});

describe("buildExtractionInstructions", () => {
  it("documents the typed object format and the sentinel", () => {
    const text = buildExtractionInstructions();
    expect(text).toContain("<<FACTS>>");
    expect(text).toContain('"type"');
    expect(text).toMatch(/only new/i);
  });
});
```

Also update the import at the top of the file to include `parseRoughDate` (merge into the existing import from `../src/core/memory`).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- memory.test.ts`
Expected: FAIL — `items` undefined / `parseRoughDate` not exported / instructions lack `"type"`.

- [ ] **Step 3: Rewrite the parser and instructions**

In `app/src/core/memory.ts`, update the type import and replace `parseChatReply` and `buildExtractionInstructions`, and add `parseRoughDate`:

```typescript
import type { Memory, ExtractedItem } from "./types";
```

```typescript
const MAX_ITEMS = 5;

function toItem(raw: unknown): ExtractedItem | null {
  if (typeof raw === "string") {
    const text = raw.trim();
    return text ? { kind: "entity", type: "fact", text } : null;
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!text) return null;
    if (o.type === "event") {
      const date = typeof o.date === "string" && o.date.trim() ? o.date.trim() : null;
      return { kind: "event", text, date };
    }
    if (o.type === "person" || o.type === "goal") {
      const attrs = o.attributes && typeof o.attributes === "object" ? (o.attributes as Record<string, unknown>) : undefined;
      return attrs ? { kind: "entity", type: o.type, text, attributes: attrs } : { kind: "entity", type: o.type, text };
    }
    return { kind: "entity", type: "fact", text }; // missing / unknown type
  }
  return null;
}

// Splits a chat reply into the spoken text and any structured items the model
// appended after the `<<FACTS>>` sentinel (inline or own-line). Maximally
// tolerant: unparseable yields no items and keeps the whole text as the reply.
export function parseChatReply(raw: string): { reply: string; items: ExtractedItem[] } {
  const idx = raw.indexOf(FACTS_SENTINEL);
  if (idx === -1) return { reply: raw.trim(), items: [] };

  const reply = raw.slice(0, idx).trim();
  const rest = raw.slice(idx + FACTS_SENTINEL.length).trim();
  let items: ExtractedItem[] = [];
  try {
    const parsed = JSON.parse(rest);
    if (Array.isArray(parsed)) {
      items = parsed
        .map(toItem)
        .filter((x): x is ExtractedItem => x !== null)
        .slice(0, MAX_ITEMS);
    }
  } catch {
    items = [];
  }
  return { reply, items };
}

// Parses a rough date string ("YYYY-MM" or "YYYY-MM-DD") to epoch ms, or null.
export function parseRoughDate(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = m[3] ? Number(m[3]) : 1;
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return new Date(year, month, day).getTime();
}

// Appended to the chat system prompt: how to surface durable, new items.
export function buildExtractionInstructions(): string {
  return [
    `After your spoken reply, if the user revealed something durable and new (not`,
    `already listed above), append a line containing exactly ${FACTS_SENTINEL} then a JSON`,
    `array of objects. Each object has a "type" and a "text":`,
    `- {"type":"person","text":"Mika"} for a person in their life`,
    `- {"type":"goal","text":"visit Germany"} for a goal or plan they care about`,
    `- {"type":"event","text":"booked a Germany trip","date":"2026-07"} for something that happened (date optional, YYYY-MM or YYYY-MM-DD)`,
    `- {"type":"fact","text":"is vegetarian"} for any other durable fact or preference`,
    `Capture at most 5, only new ones. Skip transient moods and anything already known.`,
    `If there is nothing new, write nothing after your reply. Never mention ${FACTS_SENTINEL}`,
    `or the items in your spoken reply.`,
  ].join("\n");
}
```

Note: `buildRecall` stays for now (still imported by `turn.ts`); it is removed in Task 8.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- memory.test.ts && pnpm typecheck`
Expected: memory tests PASS. `pnpm typecheck` will now report errors in `turn.ts` (uses old `{facts}`) — that is expected and fixed in Task 8. If you want a clean typecheck now, run only the targeted test; the suite-wide green gate is Task 8.

- [ ] **Step 5: Commit**

```bash
git add app/src/core/memory.ts app/__tests__/memory.test.ts
git commit -m "feat(app): typed extraction parser (entities/events) + rough date

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Deterministic linking

**Files:**
- Create: `app/src/core/linking.ts`
- Test: `app/__tests__/linking.test.ts`

**Interfaces:**
- Consumes: `Entity`, `LifeEvent` (Task 1).
- Produces: `deriveLinks(turn: { entities: Entity[]; events: LifeEvent[] }, known: Entity[]): Array<[string, string]>` — returns `[eventId, entityId]` pairs (event→entity direction).

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/linking.test.ts`:

```typescript
import { deriveLinks } from "../src/core/linking";
import type { Entity, LifeEvent } from "../src/core/types";

function ent(id: string, name: string): Entity {
  return { id, type: "person", name, attributes: null, lastMentionedAt: 0, createdAt: 0 };
}
function ev(id: string, text: string): LifeEvent {
  return { id, text, occurredAt: null, createdAt: 0 };
}

describe("deriveLinks", () => {
  it("links an event to a known entity named in its text", () => {
    const links = deriveLinks({ entities: [], events: [ev("v1", "booked Germany trip with Mika")] }, [ent("e1", "Mika")]);
    expect(links).toEqual([["v1", "e1"]]);
  });

  it("does not link on a substring (whole-word match only)", () => {
    const links = deriveLinks({ entities: [], events: [ev("v1", "ate a banana")] }, [ent("e1", "Ana")]);
    expect(links).toEqual([]);
  });

  it("links every same-turn entity to every same-turn event", () => {
    const links = deriveLinks(
      { entities: [ent("e1", "Mika")], events: [ev("v1", "researched flights")] },
      []
    );
    expect(links).toEqual([["v1", "e1"]]);
  });

  it("does not duplicate a pair matched both by name and same-turn", () => {
    const links = deriveLinks(
      { entities: [ent("e1", "Mika")], events: [ev("v1", "trip with Mika")] },
      []
    );
    expect(links).toEqual([["v1", "e1"]]);
  });

  it("returns nothing when there are no events", () => {
    expect(deriveLinks({ entities: [ent("e1", "Mika")], events: [] }, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- linking.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/src/core/linking.ts`:

```typescript
import type { Entity, LifeEvent } from "./types";

// Whole-word, case-insensitive presence of `name` in `text`.
function mentions(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

// Derives [eventId, entityId] links: an event links to any entity named in its
// text (known or just-added), and to every entity created in the same turn.
export function deriveLinks(
  turn: { entities: Entity[]; events: LifeEvent[] },
  known: Entity[]
): Array<[string, string]> {
  const links: Array<[string, string]> = [];
  const seen = new Set<string>();
  const add = (from: string, to: string) => {
    const key = `${from}|${to}`;
    if (from !== to && !seen.has(key)) {
      seen.add(key);
      links.push([from, to]);
    }
  };

  const allEntities = [...known, ...turn.entities];
  for (const event of turn.events) {
    for (const entity of allEntities) {
      if (entity.name && mentions(event.text, entity.name)) add(event.id, entity.id);
    }
    for (const entity of turn.entities) add(event.id, entity.id);
  }
  return links;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- linking.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/core/linking.ts app/__tests__/linking.test.ts
git commit -m "feat(app): deterministic event-entity linking by name match

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Context retrieval

**Files:**
- Create: `app/src/core/context.ts`
- Test: `app/__tests__/context.test.ts`

**Interfaces:**
- Consumes: `Entity`, `LifeEvent` (Task 1).
- Produces: `tokenize(s: string): string[]`; `ContextSnapshot` interface; `buildContext(snapshot: ContextSnapshot): string`.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/context.test.ts`:

```typescript
import { tokenize, buildContext, type ContextSnapshot } from "../src/core/context";
import type { Entity, LifeEvent } from "../src/core/types";

function ent(id: string, type: Entity["type"], name: string, attributes: Record<string, unknown> | null = null): Entity {
  return { id, type, name, attributes, lastMentionedAt: 0, createdAt: 0 };
}
function ev(id: string, text: string, occurredAt: number | null = null): LifeEvent {
  return { id, text, occurredAt, createdAt: 0 };
}
const empty: ContextSnapshot = { people: [], goals: [], recentEvents: [], searchHits: [] };

describe("tokenize", () => {
  it("lowercases, drops stopwords and short tokens, dedups", () => {
    expect(tokenize("What should I buy Mika for Mika?")).toEqual(["should", "buy", "mika"]);
  });
});

describe("buildContext", () => {
  it("returns empty string for an empty model", () => {
    expect(buildContext(empty)).toBe("");
  });

  it("always includes people and goals, with attributes", () => {
    const out = buildContext({
      ...empty,
      people: [ent("p1", "person", "Mika", { birthday: "10-12" })],
      goals: [ent("g1", "goal", "visit Germany")],
    });
    expect(out).toContain("People you know:");
    expect(out).toContain("- Mika (birthday 10-12)");
    expect(out).toContain("Your goals:");
    expect(out).toContain("- visit Germany");
  });

  it("renders recent events with a month label", () => {
    const out = buildContext({ ...empty, recentEvents: [ev("v1", "booked trip", new Date(2026, 6, 1).getTime())] });
    expect(out).toContain("Recent in your life:");
    expect(out).toContain("- 2026-07: booked trip");
  });

  it("includes keyword hits not already shown", () => {
    const shown = ent("p1", "person", "Mika");
    const hit = ev("v9", "old gift idea");
    const out = buildContext({ ...empty, people: [shown], searchHits: [shown, hit] });
    expect(out).toContain("Related to what you said:");
    expect(out).toContain("- old gift idea");
    // the already-shown person is not repeated in the related section
    expect(out.split("Mika").length - 1).toBe(1);
  });

  it("caps total lines at 40", () => {
    const people = Array.from({ length: 50 }, (_, i) => ent(`p${i}`, "person", `Person${i}`));
    const out = buildContext({ ...empty, people });
    const lines = out.split("\n").filter((l) => l.startsWith("- "));
    expect(lines.length).toBe(40);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- context.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/src/core/context.ts`:

```typescript
import type { Entity, LifeEvent } from "./types";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "to", "of", "in", "on", "at",
  "is", "are", "was", "my", "you", "it", "this", "that", "with", "do",
]);

export function tokenize(s: string): string[] {
  return Array.from(
    new Set(
      s.toLowerCase().split(/[^a-z0-9']+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    )
  );
}

export interface ContextSnapshot {
  people: Entity[];
  goals: Entity[];
  recentEvents: LifeEvent[];
  searchHits: (Entity | LifeEvent)[];
}

const CAP = 40;

function isEntity(x: Entity | LifeEvent): x is Entity {
  return (x as Entity).type !== undefined;
}

function monthLabel(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}: `;
}

function entityLine(e: Entity): string {
  const attrs = e.attributes
    ? Object.entries(e.attributes).map(([k, v]) => `${k} ${v}`).join(", ")
    : "";
  return attrs ? `- ${e.name} (${attrs})` : `- ${e.name}`;
}

function eventLine(e: LifeEvent): string {
  return `- ${monthLabel(e.occurredAt)}${e.text}`;
}

// Formats a bounded, relevant slice of the life-model for the chat prompt.
// Empty model → "" (same contract as the former buildRecall).
export function buildContext(snapshot: ContextSnapshot): string {
  const sections: string[] = [];
  const shown = new Set<string>();
  let used = 0;
  const room = () => Math.max(0, CAP - used);

  const take = <T extends { id: string }>(arr: T[]): T[] => {
    const out = arr.slice(0, room());
    for (const x of out) shown.add(x.id);
    used += out.length;
    return out;
  };

  const people = take(snapshot.people);
  if (people.length) sections.push("People you know:\n" + people.map(entityLine).join("\n"));

  const goals = take(snapshot.goals);
  if (goals.length) sections.push("Your goals:\n" + goals.map(entityLine).join("\n"));

  const recent = take(snapshot.recentEvents);
  if (recent.length) sections.push("Recent in your life:\n" + recent.map(eventLine).join("\n"));

  const hits = take(snapshot.searchHits.filter((x) => !shown.has(x.id)));
  if (hits.length) {
    const lines = hits.map((x) => (isEntity(x) ? entityLine(x) : eventLine(x)));
    sections.push("Related to what you said:\n" + lines.join("\n"));
  }

  return sections.join("\n\n");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- context.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/core/context.ts app/__tests__/context.test.ts
git commit -m "feat(app): capped people+goals+recent+keyword context retrieval

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: LifeStore interface + in-memory implementation

**Files:**
- Create: `app/src/core/life-store.ts`
- Create: `app/src/core/life-store-memory.ts`
- Test: `app/__tests__/life-store-memory.test.ts`

**Interfaces:**
- Consumes: `Entity`, `EntityType`, `LifeEvent` (Task 1).
- Produces: `LifeStore` interface; `createInMemoryLifeStore(seedEntities?, seedEvents?): LifeStore`.

- [ ] **Step 1: Define the interface**

Create `app/src/core/life-store.ts`:

```typescript
import type { Entity, EntityType, LifeEvent } from "./types";

export interface LifeStore {
  upsertEntity(
    type: EntityType,
    name: string,
    attributes: Record<string, unknown> | null,
    now: number,
    newId: () => string
  ): Promise<Entity>;
  addEvent(text: string, occurredAt: number | null, now: number, newId: () => string): Promise<LifeEvent>;
  link(fromId: string, toId: string): Promise<void>;
  people(): Promise<Entity[]>;
  goals(): Promise<Entity[]>;
  facts(): Promise<Entity[]>;
  recentEvents(limit: number): Promise<LifeEvent[]>;
  search(tokens: string[]): Promise<(Entity | LifeEvent)[]>;
  eventsForEntity(entityId: string): Promise<LifeEvent[]>;
  deleteEntity(id: string): Promise<void>;
}
```

- [ ] **Step 2: Write the failing tests**

Create `app/__tests__/life-store-memory.test.ts`:

```typescript
import { createInMemoryLifeStore } from "../src/core/life-store-memory";

let counter = 0;
const newId = () => `id-${++counter}`;
beforeEach(() => { counter = 0; });

describe("createInMemoryLifeStore", () => {
  it("dedups entities by (type, lower name), bumps lastMentionedAt and merges attributes", async () => {
    const s = createInMemoryLifeStore();
    const a = await s.upsertEntity("person", "Mika", { birthday: "10-12" }, 1, newId);
    const b = await s.upsertEntity("person", "mika", { city: "Berlin" }, 5, newId);
    expect(b.id).toBe(a.id);
    expect(b.lastMentionedAt).toBe(5);
    expect(b.attributes).toEqual({ birthday: "10-12", city: "Berlin" });
    expect((await s.people()).length).toBe(1);
  });

  it("keeps different types with the same name separate", async () => {
    const s = createInMemoryLifeStore();
    await s.upsertEntity("person", "Germany", null, 1, newId);
    await s.upsertEntity("goal", "Germany", null, 1, newId);
    expect((await s.people()).length).toBe(1);
    expect((await s.goals()).length).toBe(1);
  });

  it("lists facts and deletes an entity", async () => {
    const s = createInMemoryLifeStore();
    const f = await s.upsertEntity("fact", "is vegetarian", null, 1, newId);
    expect((await s.facts()).map((e) => e.name)).toEqual(["is vegetarian"]);
    await s.deleteEntity(f.id);
    expect(await s.facts()).toEqual([]);
  });

  it("orders recent events by occurredAt, falling back to createdAt", async () => {
    const s = createInMemoryLifeStore();
    await s.addEvent("older", 100, 1, newId);
    await s.addEvent("newer", 200, 1, newId);
    await s.addEvent("no date", null, 50, newId);
    expect((await s.recentEvents(2)).map((e) => e.text)).toEqual(["newer", "older"]);
  });

  it("links idempotently and finds events for an entity", async () => {
    const s = createInMemoryLifeStore();
    const p = await s.upsertEntity("person", "Mika", null, 1, newId);
    const e = await s.addEvent("trip with Mika", null, 1, newId);
    await s.link(e.id, p.id);
    await s.link(e.id, p.id);
    expect((await s.eventsForEntity(p.id)).map((x) => x.text)).toEqual(["trip with Mika"]);
  });

  it("searches entity names and event texts by token, empty tokens → []", async () => {
    const s = createInMemoryLifeStore();
    await s.upsertEntity("person", "Mika", null, 1, newId);
    await s.addEvent("gift idea", null, 1, newId);
    expect(await s.search([])).toEqual([]);
    const hits = await s.search(["gift"]);
    expect(hits.map((x) => ("text" in x ? x.text : x.name))).toEqual(["gift idea"]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- life-store-memory.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `app/src/core/life-store-memory.ts`:

```typescript
import type { Entity, LifeEvent } from "./types";
import type { LifeStore } from "./life-store";

export function createInMemoryLifeStore(
  seedEntities: Entity[] = [],
  seedEvents: LifeEvent[] = []
): LifeStore {
  const entities: Entity[] = [...seedEntities];
  const events: LifeEvent[] = [...seedEvents];
  const links: Array<[string, string]> = [];

  return {
    async upsertEntity(type, name, attributes, now, newId) {
      const key = name.trim().toLowerCase();
      const existing = entities.find((e) => e.type === type && e.name.toLowerCase() === key);
      if (existing) {
        existing.lastMentionedAt = now;
        if (attributes) existing.attributes = { ...(existing.attributes ?? {}), ...attributes };
        return existing;
      }
      const e: Entity = {
        id: newId(), type, name: name.trim(),
        attributes: attributes ?? null, lastMentionedAt: now, createdAt: now,
      };
      entities.push(e);
      return e;
    },
    async addEvent(text, occurredAt, now, newId) {
      const e: LifeEvent = { id: newId(), text: text.trim(), occurredAt, createdAt: now };
      events.push(e);
      return e;
    },
    async link(fromId, toId) {
      if (!links.some(([f, t]) => f === fromId && t === toId)) links.push([fromId, toId]);
    },
    async people() { return entities.filter((e) => e.type === "person"); },
    async goals() { return entities.filter((e) => e.type === "goal"); },
    async facts() { return entities.filter((e) => e.type === "fact"); },
    async recentEvents(limit) {
      return [...events]
        .sort((a, b) => (b.occurredAt ?? b.createdAt) - (a.occurredAt ?? a.createdAt))
        .slice(0, limit);
    },
    async search(tokens) {
      if (!tokens.length) return [];
      const hit = (s: string) => tokens.some((t) => s.toLowerCase().includes(t));
      return [...entities.filter((e) => hit(e.name)), ...events.filter((e) => hit(e.text))];
    },
    async eventsForEntity(entityId) {
      const ids = new Set(links.filter(([, to]) => to === entityId).map(([from]) => from));
      return events.filter((e) => ids.has(e.id));
    },
    async deleteEntity(id) {
      const i = entities.findIndex((e) => e.id === id);
      if (i >= 0) entities.splice(i, 1);
    },
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test -- life-store-memory.test.ts && pnpm typecheck`
Expected: tests PASS (typecheck still flags `turn.ts` until Task 8 — expected).

- [ ] **Step 6: Commit**

```bash
git add app/src/core/life-store.ts app/src/core/life-store-memory.ts app/__tests__/life-store-memory.test.ts
git commit -m "feat(app): LifeStore interface + in-memory implementation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: SQLite LifeStore implementation

**Files:**
- Create: `app/src/db/sqlite-life-store.ts`

**Interfaces:**
- Consumes: `LifeStore` (Task 5); `rowToEntity`, `rowToEvent`, `EntityRow`, `EventRow` (Task 1); `SqliteDatabase` (`app/src/db/sqlite.ts`).
- Produces: `createSqliteLifeStore(db: SqliteDatabase): LifeStore`.

No Jest test (expo-sqlite is native — unavailable in Jest). Mirror the in-memory contract exactly; verified by `pnpm typecheck` and on-device in Task 9.

- [ ] **Step 1: Implement**

Create `app/src/db/sqlite-life-store.ts`:

```typescript
import type { LifeStore } from "../core/life-store";
import type { SqliteDatabase } from "./sqlite";
import { rowToEntity, rowToEvent, type EntityRow, type EventRow } from "./mappers";

export function createSqliteLifeStore(db: SqliteDatabase): LifeStore {
  return {
    async upsertEntity(type, name, attributes, now, newId) {
      const key = name.trim().toLowerCase();
      const rows = await db.getAllAsync<EntityRow>(
        "SELECT * FROM entity WHERE type = ? AND lower(name) = ?",
        [type, key]
      );
      const existing = rows[0];
      if (existing) {
        const prev = existing.attributes ? JSON.parse(existing.attributes) : null;
        const merged = attributes ? { ...(prev ?? {}), ...attributes } : prev;
        const mergedJson = merged ? JSON.stringify(merged) : null;
        await db.runAsync("UPDATE entity SET last_mentioned_at = ?, attributes = ? WHERE id = ?", [now, mergedJson, existing.id]);
        return rowToEntity({ ...existing, last_mentioned_at: now, attributes: mergedJson });
      }
      const id = newId();
      const attrJson = attributes ? JSON.stringify(attributes) : null;
      await db.runAsync(
        "INSERT INTO entity (id, type, name, attributes, last_mentioned_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [id, type, name.trim(), attrJson, now, now]
      );
      return { id, type, name: name.trim(), attributes: attributes ?? null, lastMentionedAt: now, createdAt: now };
    },
    async addEvent(text, occurredAt, now, newId) {
      const id = newId();
      await db.runAsync("INSERT INTO event (id, text, occurred_at, created_at) VALUES (?, ?, ?, ?)", [id, text.trim(), occurredAt, now]);
      return { id, text: text.trim(), occurredAt, createdAt: now };
    },
    async link(fromId, toId) {
      await db.runAsync("INSERT OR IGNORE INTO link (from_id, to_id) VALUES (?, ?)", [fromId, toId]);
    },
    async people() {
      return (await db.getAllAsync<EntityRow>("SELECT * FROM entity WHERE type = 'person' ORDER BY last_mentioned_at DESC")).map(rowToEntity);
    },
    async goals() {
      return (await db.getAllAsync<EntityRow>("SELECT * FROM entity WHERE type = 'goal' ORDER BY last_mentioned_at DESC")).map(rowToEntity);
    },
    async facts() {
      return (await db.getAllAsync<EntityRow>("SELECT * FROM entity WHERE type = 'fact' ORDER BY created_at ASC")).map(rowToEntity);
    },
    async recentEvents(limit) {
      return (await db.getAllAsync<EventRow>("SELECT * FROM event ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT ?", [limit])).map(rowToEvent);
    },
    async search(tokens) {
      if (!tokens.length) return [];
      const args = tokens.map((t) => `%${t.toLowerCase()}%`);
      const nameWhere = tokens.map(() => "lower(name) LIKE ?").join(" OR ");
      const textWhere = tokens.map(() => "lower(text) LIKE ?").join(" OR ");
      const ents = (await db.getAllAsync<EntityRow>(`SELECT * FROM entity WHERE ${nameWhere}`, args)).map(rowToEntity);
      const evs = (await db.getAllAsync<EventRow>(`SELECT * FROM event WHERE ${textWhere}`, args)).map(rowToEvent);
      return [...ents, ...evs];
    },
    async eventsForEntity(entityId) {
      return (await db.getAllAsync<EventRow>(
        "SELECT e.* FROM event e JOIN link l ON l.from_id = e.id WHERE l.to_id = ? ORDER BY COALESCE(e.occurred_at, e.created_at) DESC",
        [entityId]
      )).map(rowToEvent);
    },
    async deleteEntity(id) {
      await db.runAsync("DELETE FROM entity WHERE id = ?", [id]);
      await db.runAsync("DELETE FROM link WHERE from_id = ? OR to_id = ?", [id, id]);
    },
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: no new errors in `sqlite-life-store.ts` (turn.ts errors remain until Task 8).

- [ ] **Step 3: Commit**

```bash
git add app/src/db/sqlite-life-store.ts
git commit -m "feat(app): SQLite LifeStore implementation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Memory migration

**Files:**
- Create: `app/src/core/migrate.ts`
- Test: `app/__tests__/migrate.test.ts`

**Interfaces:**
- Consumes: `LifeStore` (Task 5); `MemoryRepository`, `PreferenceRepository` (`app/src/core/repository.ts`).
- Produces: `migrateMemories(deps: { store: LifeStore; memories: MemoryRepository; prefs: PreferenceRepository; newId: () => string }): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/migrate.test.ts`:

```typescript
import { migrateMemories } from "../src/core/migrate";
import { createInMemoryLifeStore } from "../src/core/life-store-memory";
import { createInMemoryMemoryRepository, createMemoryPreferenceRepository } from "../src/core/memory-repository";

let counter = 0;
const newId = () => `id-${++counter}`;
beforeEach(() => { counter = 0; });

describe("migrateMemories", () => {
  it("copies legacy memory rows into fact entities once", async () => {
    const store = createInMemoryLifeStore();
    const memories = createInMemoryMemoryRepository([
      { id: "m1", text: "is vegetarian", createdAt: 10 },
      { id: "m2", text: "my wife is Ana", createdAt: 20 },
    ]);
    const prefs = createMemoryPreferenceRepository();

    await migrateMemories({ store, memories, prefs, newId });
    expect((await store.facts()).map((e) => e.name)).toEqual(["is vegetarian", "my wife is Ana"]);
    expect(await prefs.get("life_model_migrated")).toBe("1");
  });

  it("does not run twice", async () => {
    const store = createInMemoryLifeStore();
    const memories = createInMemoryMemoryRepository([{ id: "m1", text: "is vegetarian", createdAt: 10 }]);
    const prefs = createMemoryPreferenceRepository({ life_model_migrated: "1" });

    await migrateMemories({ store, memories, prefs, newId });
    expect(await store.facts()).toEqual([]);
  });

  it("sets the flag even when there are no rows", async () => {
    const store = createInMemoryLifeStore();
    const prefs = createMemoryPreferenceRepository();
    await migrateMemories({ store, memories: createInMemoryMemoryRepository(), prefs, newId });
    expect(await prefs.get("life_model_migrated")).toBe("1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- migrate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/src/core/migrate.ts`:

```typescript
import type { LifeStore } from "./life-store";
import type { MemoryRepository, PreferenceRepository } from "./repository";

const FLAG = "life_model_migrated";

// One-time copy of legacy flat `memory` rows into entity(type='fact'). Idempotent
// via a preference flag. The memory table is left in place but no longer written.
export async function migrateMemories(deps: {
  store: LifeStore;
  memories: MemoryRepository;
  prefs: PreferenceRepository;
  newId: () => string;
}): Promise<void> {
  if ((await deps.prefs.get(FLAG)) === "1") return;
  for (const m of await deps.memories.list()) {
    await deps.store.upsertEntity("fact", m.text, null, m.createdAt, deps.newId);
  }
  await deps.prefs.set(FLAG, "1");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- migrate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/core/migrate.ts app/__tests__/migrate.test.ts
git commit -m "feat(app): one-time migration of flat memories to fact entities

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Wire the turn to the life-model

**Files:**
- Modify: `app/src/app/turn.ts`
- Modify: `app/src/core/memory.ts` (remove `buildRecall`)
- Modify: `app/__tests__/memory.test.ts` (remove `buildRecall` tests)
- Test: `app/__tests__/turn.test.ts`

**Interfaces:**
- Consumes: `LifeStore` (Task 5); `parseChatReply`, `parseRoughDate` (Task 2); `deriveLinks` (Task 3); `tokenize`, `buildContext`, `ContextSnapshot` (Task 4); `buildChatSystemPrompt`, `getPersonaName` (existing).
- Produces: `runTurn` deps now take `store: LifeStore` instead of `memories: MemoryRepository`. Same `TurnResult` union.

- [ ] **Step 1: Remove `buildRecall` and its tests**

In `app/src/core/memory.ts`, delete the `buildRecall` function (lines defining it) and remove `Memory` from imports if it becomes unused (keep `ExtractedItem`). In `app/__tests__/memory.test.ts`, delete the `describe("buildRecall", …)` block and the `Memory` import and `buildRecall` from the import list.

- [ ] **Step 2: Update the turn tests**

Replace the contents of `app/__tests__/turn.test.ts` with:

```typescript
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
    const api: BramApi = { news: jest.fn(async () => []), chat: jest.fn(async () => "Good morning.") };
    const result = await runTurn(deps(api), "good morning");
    expect(result).toEqual({ kind: "briefing", text: "Good morning." });
  });

  it("stores a fact entity on a 'remember that' utterance without calling the LLM", async () => {
    const store = createInMemoryLifeStore();
    const api: BramApi = { news: jest.fn(async () => []), chat: jest.fn(async () => "") };
    const result = await runTurn(deps(api, store), "remember that my wife is Ana");
    expect(result).toEqual({ kind: "remember", text: "Got it — I'll remember that." });
    expect((await store.facts()).map((e) => e.name)).toEqual(["my wife is Ana"]);
    expect(api.chat).not.toHaveBeenCalled();
  });

  it("stores typed items from a chat turn, links them, and returns the clean reply", async () => {
    const store = createInMemoryLifeStore();
    const reply = 'Nice! <<FACTS>>[{"type":"person","text":"Mika"},{"type":"event","text":"booked Germany trip with Mika","date":"2026-07"}]';
    const chat = jest.fn().mockResolvedValueOnce("[]").mockResolvedValueOnce(reply);
    const api: BramApi = { news: jest.fn(async () => []), chat };
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
    const api: BramApi = { news: jest.fn(async () => []), chat };
    await runTurn(deps(api, store), "what should I plan");
    const systemPrompt = chat.mock.calls[1][0] as string;
    expect(systemPrompt).toContain("People you know:");
    expect(systemPrompt).toContain("Mika");
    expect(systemPrompt).toContain("visit Germany");
  });

  it("falls back to a clean reply with no items", async () => {
    const store = createInMemoryLifeStore();
    const chat = jest.fn().mockResolvedValueOnce("[]").mockResolvedValueOnce("Just chatting.");
    const api: BramApi = { news: jest.fn(async () => []), chat };
    const result = await runTurn(deps(api, store), "how are you");
    expect(result).toEqual({ kind: "chat", text: "Just chatting." });
    expect(await store.facts()).toEqual([]);
  });
});
```

(The capture-plan test is unchanged behavior but the `deps` shape changed; the rewrite above drops the standalone capture assertion since capture is covered in `capture-service.test.ts`. Keep the briefing, remember, chat-store, injection, and fallback tests as written.)

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test -- turn.test.ts`
Expected: FAIL — `store` not on deps / `parseChatReply` returns items not yet consumed.

- [ ] **Step 4: Rewrite `turn.ts`**

Replace `app/src/app/turn.ts` with:

```typescript
import type { BramApi } from "../core/api";
import type { PlanRepository, PreferenceRepository, TopicRepository } from "../core/repository";
import type { LifeStore } from "../core/life-store";
import type { Notifier } from "../notify/notifier";
import type { CalendarService } from "../calendar/calendar";
import type { Entity, LifeEvent } from "../core/types";
import { morningBriefing } from "../core/briefing-service";
import { capturePlans } from "../core/capture-service";
import { buildChatSystemPrompt, getPersonaName } from "../core/persona";
import { isRememberIntent, stripRememberLead, parseChatReply, parseRoughDate } from "../core/memory";
import { deriveLinks } from "../core/linking";
import { tokenize, buildContext, type ContextSnapshot } from "../core/context";

export type TurnResult =
  | { kind: "briefing"; text: string }
  | { kind: "capture"; text: string; count: number }
  | { kind: "remember"; text: string }
  | { kind: "chat"; text: string };

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
    store: LifeStore;
    notifier: Notifier;
    calendar: CalendarService;
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
      calendar: deps.calendar,
      now: deps.now,
    });
    return { kind: "briefing", text };
  }

  // "Remember that…" → store a durable fact entity. Checked before capture.
  if (isRememberIntent(utterance)) {
    const fact = stripRememberLead(utterance);
    if (fact) {
      await deps.store.upsertEntity("fact", fact, null, deps.now, deps.newId);
      return { kind: "remember", text: "Got it — I'll remember that." };
    }
  }

  const captured = await capturePlans(
    { api: deps.api, repo: deps.plans, notifier: deps.notifier, now: deps.now, newId: deps.newId },
    utterance
  );
  if (captured.length) {
    return {
      kind: "capture",
      text: `Got it — ${captured.map((p) => p.title).join(", ")}.`,
      count: captured.length,
    };
  }

  // Conversational turn: inject a relevant slice of the life-model, then extract
  // any new typed items the model surfaced and link them.
  // ponytail: capture-first means 2 LLM calls per chat turn; add an intent
  // classifier (one call) if free-tier rate limits start biting.
  const persona = await getPersonaName(deps.prefs);
  const tokens = tokenize(utterance);
  const snapshot: ContextSnapshot = {
    people: await deps.store.people(),
    goals: await deps.store.goals(),
    recentEvents: await deps.store.recentEvents(10),
    searchHits: await deps.store.search(tokens),
  };
  const recall = buildContext(snapshot);
  const raw = await deps.api.chat(buildChatSystemPrompt(persona, recall), [
    { role: "user", content: utterance },
  ]);
  const { reply, items } = parseChatReply(raw);

  const turnEntities: Entity[] = [];
  const turnEvents: LifeEvent[] = [];
  for (const item of items) {
    if (item.kind === "event") {
      turnEvents.push(await deps.store.addEvent(item.text, parseRoughDate(item.date), deps.now, deps.newId));
    } else {
      turnEntities.push(
        await deps.store.upsertEntity(item.type, item.text, item.attributes ?? null, deps.now, deps.newId)
      );
    }
  }
  if (turnEvents.length) {
    const known = [...(await deps.store.people()), ...(await deps.store.goals()), ...(await deps.store.facts())];
    for (const [from, to] of deriveLinks({ entities: turnEntities, events: turnEvents }, known)) {
      await deps.store.link(from, to);
    }
  }

  return { kind: "chat", text: reply };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test -- turn.test.ts memory.test.ts`
Expected: PASS. (Suite-wide green is Task 9, after DI is repointed.)

- [ ] **Step 6: Commit**

```bash
git add app/src/app/turn.ts app/src/core/memory.ts app/__tests__/turn.test.ts app/__tests__/memory.test.ts
git commit -m "feat(app): route chat turns through the life-model store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Repoint DI, screens, and run migration

**Files:**
- Modify: `app/src/app/services.tsx`
- Modify: `app/src/app/build-services.ts`
- Modify: `app/src/screens/ConversationScreen.tsx:49`
- Modify: `app/src/screens/SettingsScreen.tsx`
- Test: `app/__tests__/services.test.tsx`, `app/__tests__/ConversationScreen.test.tsx`

**Interfaces:**
- Consumes: `LifeStore` (Task 5), `createSqliteLifeStore` (Task 6), `migrateMemories` (Task 7).
- Produces: `Services.store: LifeStore` (replaces `Services.memories`). App compiles and the full suite + typecheck pass.

- [ ] **Step 1: Update the `Services` interface**

In `app/src/app/services.tsx`: remove `MemoryRepository` from the imports and the interface; add `store`. Replace the import block's `MemoryRepository,` line (drop it) and replace the `memories: MemoryRepository;` field with:

```typescript
import type { LifeStore } from "../core/life-store";
```

```typescript
  store: LifeStore;
```

- [ ] **Step 2: Wire the SQLite store + migration in `build-services.ts`**

Replace `app/src/app/build-services.ts` with:

```typescript
import * as Crypto from "expo-crypto";
import { createBramApi } from "../core/api";
import {
  createSqlitePlanRepository,
  createSqlitePreferenceRepository,
  createSqliteTopicRepository,
  createSqliteMemoryRepository,
} from "../db/sqlite-repository";
import { createSqliteLifeStore } from "../db/sqlite-life-store";
import { migrateMemories } from "../core/migrate";
import { openBramDatabase } from "../db/open";
import { createSpeaker } from "../speech/tts";
import { createVoiceCapture } from "../speech/stt";
import { createNotifier } from "../notify/notifier";
import { createCalendar } from "../calendar/calendar";
import { getPersonaName } from "../core/persona";
import { getBackendBaseUrl } from "./config";
import type { Services } from "./services";

export async function buildServices(): Promise<Services> {
  const db = await openBramDatabase();
  const prefs = createSqlitePreferenceRepository(db);
  const store = createSqliteLifeStore(db);
  const newId = () => Crypto.randomUUID();

  // One-time copy of legacy flat memories into the life-model.
  await migrateMemories({ store, memories: createSqliteMemoryRepository(db), prefs, newId });

  return {
    api: createBramApi({ baseUrl: getBackendBaseUrl() }),
    plans: createSqlitePlanRepository(db),
    topics: createSqliteTopicRepository(db),
    prefs,
    store,
    speaker: createSpeaker(),
    voice: createVoiceCapture(),
    notifier: createNotifier(() => getPersonaName(prefs)),
    calendar: createCalendar(),
    newId,
    now: () => Date.now(),
  };
}
```

- [ ] **Step 3: Update `ConversationScreen.tsx`**

In `app/src/screens/ConversationScreen.tsx`, on the `runTurn` deps line (≈49), replace `memories: s.memories,` with `store: s.store,`.

- [ ] **Step 4: Update `SettingsScreen.tsx`**

In `app/src/screens/SettingsScreen.tsx`:
- Change the type import from `import type { NewsTopic, Memory } from "../core/types";` to `import type { NewsTopic, Entity } from "../core/types";`
- Change `const [memories, setMemories] = useState<Memory[]>([]);` to `const [memories, setMemories] = useState<Entity[]>([]);`
- Change `s.memories.list().then(setMemories);` to `s.store.facts().then(setMemories);`
- Change `forget` to:

```typescript
  const forget = async (id: string) => {
    await s.store.deleteEntity(id);
    setMemories(await s.store.facts());
  };
```
- In the render, `m.text` appears in **two** places — the displayed `<Text style={styles.factText}>{m.text}</Text>` and the `accessibilityLabel={`forget: ${m.text}`}`. Change both to `m.name` (the fact entity's text is its `name`).

- [ ] **Step 5: Update the DI-touching tests**

Both DI tests provide an inline mock object for the field:
`memories: { add: async () => {}, list: async () => [], delete: async () => {} },`

In `app/__tests__/services.test.tsx` (line ≈18) and `app/__tests__/ConversationScreen.test.tsx` (line ≈26), replace that line with:

```typescript
    store: createInMemoryLifeStore(),
```

and add to the top of each file:

```typescript
import { createInMemoryLifeStore } from "../src/core/life-store-memory";
```

- [ ] **Step 6: Run the full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: ALL tests PASS, no type errors. If `services.test.tsx` or `ConversationScreen.test.tsx` reference `memories`, fix those references to `store`.

- [ ] **Step 7: Commit**

```bash
git add app/src/app/services.tsx app/src/app/build-services.ts app/src/screens/ConversationScreen.tsx app/src/screens/SettingsScreen.tsx app/__tests__/services.test.tsx app/__tests__/ConversationScreen.test.tsx
git commit -m "feat(app): repoint DI and screens to LifeStore, run migration on boot

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Manual on-device verification (after Task 9)

JS-only changes hot-reload via Metro (no native rebuild — the schema is created by the existing `openBramDatabase` runner on next launch). On the Pixel_7 emulator:

1. Reload the app; confirm it boots (migration runs once; empty DB → no-op).
2. In Talk, say: "my girlfriend Mika is vegetarian and her birthday is October 12". Confirm the spoken reply is clean (no `<<FACTS>>`).
3. Settings → "What Bram knows": confirm a fact/person appears (Mika).
4. Say: "we just booked our Germany trip with Mika". Then ask: "what should I get Mika as a gift?" — confirm the reply reflects knowing Mika (the keyword retrieval pulled her in).
5. Pull the DB (`adb exec-out run-as com.davidl.on.app cat files/SQLite/bram.db > out.db`, inspect with Python sqlite3) and confirm `entity`, `event`, and `link` rows exist with sane values.

If structured items never appear, log `raw` + `items` in the chat branch under `__DEV__`, read via `adb logcat ReactNativeJS:V '*:S'`, then revert. Free models vary; degrade-to-fact means worst case you still get facts.

---

## Self-Review

- **Spec coverage:** schema → Task 1; types → Task 1; typed extraction + tolerant degrade + cap → Task 2; rough date → Task 2; linking (whole-word, same-turn) → Task 3; retrieval (people+goals+recent+keyword, cap, empty→"") → Task 4; LifeStore seam + dedup/merge/idempotent link → Tasks 5/6; migration (once, flagged) → Task 7; turn wiring (chat + remember + buildContext) → Task 8; DI + Settings repoint + boot migration → Task 9. All spec sections mapped.
- **Placeholder scan:** none — every code step has complete code; SQLite-impl-not-jest-tested is an explicit, justified constraint, not a deferral.
- **Type consistency:** `parseChatReply → {reply, items}` consistent across Tasks 2/8; `Entity`/`LifeEvent`/`ExtractedItem` consistent Tasks 1→8; `LifeStore` method names (`upsertEntity`, `addEvent`, `link`, `people`, `goals`, `facts`, `recentEvents`, `search`, `eventsForEntity`, `deleteEntity`) consistent across Tasks 5/6/7/8/9; `ContextSnapshot` shape consistent Tasks 4/8; `buildContext(snapshot)` single-arg consistent Tasks 4/8.
