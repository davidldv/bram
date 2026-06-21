# Bram — Personal Memory Store

Date: 2026-06-20
Status: Approved (design); implementing

## Goal

Make Bram "know you." A local store of durable personal facts the assistant
writes on command and recalls in conversation — the differentiator versus
Siri/Google (no real memory) and ChatGPT/Claude apps (shallow, cloud-bound).
Local-first: facts live in on-device SQLite; nothing new leaves the device
except, as today, the text Bram already sends to the LLM per turn.

## Scope (v1)

- **Facts in:** explicit only — "remember that…", "don't forget…", "note
  that…", "keep in mind…". No automatic extraction from conversation (deferred).
- **Facts out:** all stored facts injected into the **chat** system prompt only.
  Inject-all (no retrieval/embeddings).
- **Manage:** view + delete facts in Settings. No voice "forget" (deferred).
- No native rebuild — pure JS + one new SQLite table.

## Storage

- New table:
  ```sql
  CREATE TABLE IF NOT EXISTS memory (
    id TEXT PRIMARY KEY NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  ```
  Added to `SCHEMA_SQL` (runs on every open; existing DBs get it automatically).
- New type: `Memory { id: string; text: string; createdAt: number }`.
- `MemoryRepository { add(m: Memory): Promise<void>; list(): Promise<Memory[]>;
  delete(id: string): Promise<void> }` — SQLite impl in `sqlite-repository.ts`,
  in-memory impl in `memory-repository.ts`, both following the existing repo
  patterns. `list()` ordered by `created_at ASC`. Added to the `Services`
  container and `build-services`.

## Facts in — the "remember" intent

Pure helpers in `src/core/memory.ts`:

- `isRememberIntent(utterance): boolean` — case-insensitive match on a leading
  "remember (that)? / don't forget (that)? / note that / keep in mind (that)?"
  phrase.
- `stripRememberLead(utterance): string` — removes that lead phrase and returns
  the trimmed fact (e.g. "remember that my wife is Ana" → "my wife is Ana").

Routing in `runTurn` (`src/app/turn.ts`) becomes, in order:

1. briefing (`isBriefingIntent`)
2. **remember (`isRememberIntent`)** — store `stripRememberLead(utterance)` as a
   `Memory` (via `memories.add`, id from `newId`, `createdAt = now`); return
   `{ kind: "remember", text: "Got it — I'll remember that." }`.
3. capture (`capturePlans`)
4. chat (conversational fallback)

Remember is checked **before** capture so a "remember that…" utterance is never
parsed as a plan. If `stripRememberLead` yields an empty string, fall through to
chat (nothing to store).

`TurnResult` gains `| { kind: "remember"; text: string }`. `ConversationScreen`
needs no change — it already renders/speaks `result.text` for any kind.

## Facts out — recall injection

In `src/core/memory.ts`:

- `buildRecall(memories: Memory[]): string` — returns
  `"Things you know about the user:\n- <text>\n- <text>"` or `""` when empty.

Injection: `buildChatSystemPrompt(name, recall?)` appends the recall block (when
non-empty) to the persona prompt. In `runTurn`'s chat branch, load
`memories.list()`, build the recall block, and pass it in.

v1 injects into chat only. `ponytail:` capture/briefing injection deferred —
capture extracts plans from the utterance itself (facts don't help and risk
muddying its strict-JSON prompt); briefing benefit is marginal.

## Managing facts — Settings

`SettingsScreen` gains a "What Bram knows" `Section`:

- Lists each fact (from `memories.list()`) as a row with the fact text and a
  delete control (tap an X / trash icon) → `memories.delete(id)` then refresh.
- Empty state: a muted line, "Nothing yet. Say 'remember that…' to teach me."

## Data flow

Unchanged elsewhere. New calls: `memories.add` on a remember turn,
`memories.list` on chat turns (for recall) and in Settings, `memories.delete`
from Settings. Facts are the single source of truth in SQLite.

## Error handling

- Empty fact after stripping → fall through to chat (no empty memory stored).
- Repository errors propagate to the existing `runTurn` try/catch in
  `ConversationScreen` (surface as the standard error bubble). Settings delete
  failure just leaves the row (refresh won't change it). No new error UI.

## Testing

- Pure (unit): `isRememberIntent` (matches the lead phrases; rejects "remind me
  to…" and plain chat); `stripRememberLead` (strips each phrase, trims, handles
  empty); `buildRecall` (formats list; returns "" when empty).
- `runTurn`: a "remember that X" utterance calls `memories.add` with the
  stripped fact and returns `kind:"remember"`; a chat turn includes the recall
  block in the system prompt passed to `api.chat` (assert via mock).
- `MemoryRepository` in-memory: add → list returns it; delete removes it.
- Existing `turn` / `ConversationScreen` / `services` test mocks get a
  `memories` repo added.

## Out of scope (deferred)

- Automatic fact extraction from conversation.
- Voice "forget that…" (ambiguous fact matching).
- Recall injection into capture/briefing prompts.
- Editing a fact's text (delete + re-add covers it).
- Dedup / fact merging / structured fields (flat natural-language facts only).

## File summary

- New: `src/core/memory.ts`, `src/core/memory.test.ts` (or under `__tests__/`).
- Edit: `src/core/types.ts`, `src/core/repository.ts`,
  `src/core/memory-repository.ts`, `src/db/sqlite-repository.ts`,
  `src/db/mappers.ts`, `src/db/schema.ts`, `src/core/persona.ts`,
  `src/app/turn.ts`, `src/app/services.tsx`, `src/app/build-services.ts`,
  `src/screens/SettingsScreen.tsx`, and the affected test mocks.
- Untouched: backend, native config, voice/speech, notifications, UI primitives.
