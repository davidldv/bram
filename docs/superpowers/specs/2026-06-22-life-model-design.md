# Life-model data model + extraction design

**Date:** 2026-06-22
**Status:** Approved (design)

## Problem

Bram stores isolated flat facts. To become a digital companion it needs a
**life-model**: people, goals, and a timeline of events, connected by
relationships, built up gradually from normal conversation. This model is the
foundation; the Timeline / People / Goals / Home-dashboard / proactive-check-in
features are all *views and queries over it* and are out of scope here (each gets
its own later spec). The model — not the LLM — is the product; a swappable
free-tier model just follows the structure this layer provides.

## Scope

In scope: the SQLite schema (entity/event/link), the structured extraction that
populates it (piggybacked on the existing chat call), deterministic in-code
linking, the retrieval that injects a relevant slice into the chat prompt, the
`LifeStore` storage seam, and migration of existing `memory` rows.

Out of scope (separate specs): Timeline tab, People DB tab, Goals tab, Home
dashboard, proactive check-ins, health/sleep data, vector/embedding search,
cloud sync.

## Decisions (locked)

- **Entity types v1:** `person`, `goal`, `fact` (untyped catch-all). Events
  attach to entities. Easy to extend later.
- **Extraction:** the model tags each item with a `type` (and a rough `date` for
  events); CODE derives links. Piggybacks the existing chat call — no extra LLM
  call. Maximally tolerant: degrades to a plain fact, never loses data.
- **Storage:** one unified `entity` table (not a separate fact store); migrate
  existing `memory` rows into `entity(type='fact')`; retire (stop writing) the
  `memory` table.
- **Retrieval:** inject all people + goals, plus the most recent N events, plus
  keyword-matched older items; code-only, capped. Replaces `buildRecall`.
- **Local-first:** everything stays in on-device SQLite. No new network egress.
  (Cloud sync is a deferred paid tier — see project memory — not part of this.)

## Architecture

Data flows through one seam, `LifeStore`, so the chat turn and all future view
tabs read/write the model the same way:

```
chat turn → api.chat (system prompt now carries typed-extraction instructions)
          → parseChatReply(raw) → { reply, items[] }
          → for each item: upsertEntity | addEvent  (via LifeStore)
          → deriveLinks(turnEntities, turnEvents, knownEntities) → link()
          → return clean reply

chat prompt assembly ← buildContext(utterance, LifeStore)  (replaces buildRecall)
```

## Schema (additive, `CREATE TABLE IF NOT EXISTS`)

```sql
CREATE TABLE IF NOT EXISTS entity (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,              -- 'person' | 'goal' | 'fact'
  name TEXT NOT NULL,             -- "Mika" / "Visit Germany" / the fact text
  attributes TEXT,                -- optional JSON: {"birthday":"10-12","budget":50}
  last_mentioned_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,             -- "Booked Germany trip"
  occurred_at INTEGER,            -- rough epoch ms, nullable if unknown
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS link (
  from_id TEXT NOT NULL,          -- event id OR entity id
  to_id TEXT NOT NULL,            -- entity id
  PRIMARY KEY (from_id, to_id)
);
```

One `link` table serves both `event→entity` ("this event involves Mika") and
`entity→entity` ("Mika ↔ Germany trip"). No `kind` column until a query needs to
distinguish them.

## Components

### 1. Types (`core/types.ts`, extend)

```ts
export type EntityType = "person" | "goal" | "fact";
export interface Entity {
  id: string; type: EntityType; name: string;
  attributes: Record<string, unknown> | null;
  lastMentionedAt: number; createdAt: number;
}
export interface LifeEvent { id: string; text: string; occurredAt: number | null; createdAt: number; }

// Parsed-but-not-yet-stored extraction items:
export type ExtractedItem =
  | { kind: "entity"; type: EntityType; text: string; attributes?: Record<string, unknown> }
  | { kind: "event"; text: string; date: string | null };
```

### 2. Extraction parser (`core/memory.ts`, extend `parseChatReply`)

`parseChatReply(raw): { reply: string; items: ExtractedItem[] }` — same
sentinel-substring split as today (`<<FACTS>>`), but the JSON array now contains
objects. Tolerance rules (each independently tested):

- plain string element → `{ kind: "entity", type: "fact", text }`
- object with `type` in {person, goal} → `{ kind: "entity", type, text, attributes? }`
- object with `type: "event"` → `{ kind: "event", text, date }` (date optional → null)
- object with missing/unknown `type` but a `text` → `{ kind: "entity", type: "fact", text }`
- element with no usable text, non-array JSON, or parse failure → dropped / empty
- per-turn cap: at most 5 items kept (raised from 3; structured turns legitimately carry a person + event + goal together)

`buildExtractionInstructions()` is rewritten to describe the typed object format
with one concrete example, and to keep the "only new, not already known; nothing
if none; never mention the sentinel" rules.

Date parsing: `parseRoughDate(s): number | null` accepts `YYYY-MM`, `YYYY-MM-DD`,
or null; anything else → null. Stored as epoch ms (first of month if day absent).

### 3. Linking (`core/linking.ts`, new, pure)

`deriveLinks(turn: { entities: Entity[]; events: LifeEvent[] }, known: Entity[]): Array<[from, to]>`:

- For each event in the turn, scan its `text` for any known-or-just-added entity
  `name` as a **whole-word, case-insensitive** match → `link(event.id, entity.id)`.
- Link every entity created **in the same turn** to every event in that turn
  (the user just spoke about them together).
- Whole-word matching (word-boundary regex on the escaped name) avoids false hits
  like "Ana" inside "banana".

### 4. Retrieval (`core/context.ts`, new, pure) — replaces `buildRecall`

`buildContext(utterance: string, snapshot: ContextSnapshot): string` where
`ContextSnapshot = { people: Entity[]; goals: Entity[]; recentEvents: LifeEvent[]; searchHits: (Entity | LifeEvent)[] }`
(the store does the SQL; this function only formats and caps). Assembles, in order:

1. `People you know:` — all people (name + select attributes).
2. `Your goals:` — all goals.
3. `Recent in your life:` — recent events, newest first, with `occurred_at` month.
4. Keyword matches not already shown.

Hard cap: 40 total lines; fill people → goals → recent → keyword until cap.
Returns "" when the model is empty (same contract as `buildRecall`, so an empty
model behaves exactly like today). Tokenization for matching: lowercase, split on
non-word chars, drop a small stopword set and tokens < 3 chars.

### 5. Storage (`core/life-store.ts` interface; SQLite + in-memory impls)

```ts
export interface LifeStore {
  upsertEntity(type: EntityType, name: string, attributes: Record<string, unknown> | null, now: number, newId: () => string): Promise<Entity>; // dedup by (type, lower(name)); bumps lastMentionedAt; merges attributes
  addEvent(text: string, occurredAt: number | null, now: number, newId: () => string): Promise<LifeEvent>;
  link(fromId: string, toId: string): Promise<void>; // idempotent (PK)
  people(): Promise<Entity[]>;
  goals(): Promise<Entity[]>;
  recentEvents(limit: number): Promise<LifeEvent[]>;
  search(tokens: string[]): Promise<(Entity | LifeEvent)[]>; // LIKE over name/text
  eventsForEntity(entityId: string): Promise<LifeEvent[]>; // for future People/Goal views
}
```

SQLite impl in `db/sqlite-life-store.ts` (mirrors existing `sqlite-repository.ts`
patterns + mappers); in-memory impl in `core/life-store-memory.ts` for tests and
the in-memory DI path. Both must pass the same read-method parity tests.

### 6. Turn wiring (`app/turn.ts`, modify chat + remember branches)

- Chat branch: `const { reply, items } = parseChatReply(raw)`; for each item
  `upsertEntity`/`addEvent` (respecting the cap and case-insensitive dedup already
  in the store); collect this turn's entities+events; `deriveLinks(...)` →
  `store.link(...)`; return `{ kind: "chat", text: reply }`.
- Remember branch: `store.upsertEntity("fact", fact, null, now, newId)`.
- Prompt assembly: replace `buildRecall(await memories.list())` with
  `buildContext(utterance, await snapshot(store, utterance))`.

### 7. Migration (`db/schema.ts` + init in `build-services.ts`)

- Add the three `CREATE TABLE IF NOT EXISTS` statements to `SCHEMA_SQL`.
- One-time copy: if `preference` flag `life_model_migrated` is unset, read all
  `memory` rows, `upsertEntity("fact", text, null, created_at, ...)` for each,
  then set the flag. Idempotent; runs once. `memory` table left in place but no
  longer written.

## Error handling

- Extraction parse failure → reply preserved, no items (the conversation never
  breaks — same guarantee as the shipped auto-memory fix).
- Unknown/missing type → demoted to `fact`; bad date → null `occurred_at`.
- Linking false-positive guard: whole-word matching only.
- Retrieval cap prevents prompt-token blowup as the model grows.
- All store writes are best-effort within the turn; a failed write logs (dev) and
  does not throw out of `runTurn`.

## Testing

Pure logic is fully unit-tested:
- `parseChatReply` typed cases: person/goal/event objects, string→fact,
  unknown-type→fact, missing-text dropped, malformed→empty, cap at 5, date variants.
- `deriveLinks`: event text → known entity links; same-turn entity↔event links;
  no false link on substring ("Ana" in "banana").
- `buildContext`: people+goals always present; recent ordering; keyword pulls an
  old item; cap enforced; empty model → "".
- `parseRoughDate`: YYYY-MM, YYYY-MM-DD, null, garbage.
- `LifeStore`: SQLite vs in-memory parity on read methods; `upsertEntity` dedup +
  `lastMentionedAt` bump + attribute merge; `link` idempotency.
- migration: memory rows copied once into `entity(type='fact')`; flag prevents
  re-run.
- `turn`: chat turn stores typed items + derives links + returns clean reply;
  remember stores a fact entity; empty model path unchanged.

## Deferred (YAGNI)

- entity→entity links emitted by the model (we only derive event→entity + same-turn now)
- embeddings / semantic retrieval (keyword match first)
- attribute extraction beyond what the model volunteers (e.g. parsing "birthday Oct 12" into a structured field — model may put it in `attributes`, but we don't force it)
- the view tabs, dashboard, check-ins, health data, cloud sync
