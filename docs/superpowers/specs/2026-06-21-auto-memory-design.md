# Auto-memory design

**Date:** 2026-06-21
**Status:** Approved (design)

## Problem

Bram only remembers facts the user explicitly flags with `"remember…"`. The
"Jarvis that knows you" feel comes from Bram *quietly* noticing durable facts and
standing preferences during normal conversation — without being told. This spec
adds that, while protecting the trust that makes auto-memory tolerable: high
precision, easy review, no extra cost.

## Decisions (locked)

- **Capture scope:** stable personal facts (identity, relationships, durable
  preferences — "my wife is Ana", "I'm vegetarian", "I work at La Bodega") **plus
  standing preferences** about how Bram should behave ("prefer short answers",
  "call me David"). No transient state, moods, or one-off mentions.
- **Mechanism:** piggyback on the existing chat LLM call. Zero extra calls, zero
  added latency. Only chat turns extract (not capture/briefing turns).
- **Visibility:** silent. Captured facts appear in the existing Settings
  "What Bram knows" list, where the user can delete them. Trust rests on easy
  review + delete, not on confirmation prompts.
- **Dedup / contradiction:** the chat system prompt already injects existing facts
  via `buildRecall`, so the model already sees what Bram knows. Instruct it to emit
  **only genuinely new or changed** facts. On a contradiction, keep both and let the
  user delete the stale one — auto-deleting the old fact risks deleting the wrong one.

## Architecture

No new table, no new repository, no new UI, no new LLM call. The memory table,
`MemoryRepository`, `buildRecall` recall injection, and the Settings
"What Bram knows" view/delete all already exist and are reused unchanged.

The single change: the existing chat turn's one LLM call now returns **both** the
spoken reply and any new facts. The turn parses them apart, stores new facts
silently, and returns the clean reply for TTS.

### Response format

The model returns its natural reply, then *optionally* a sentinel line followed by
a JSON array of fact strings:

```
Sure, I'll keep your mornings light.
<<FACTS>>
["prefers a light schedule in the mornings"]
```

Rationale: keeping the spoken reply as free text (rather than escaping it inside a
`{reply, facts}` JSON envelope) is friendlier to TTS and far more robust to parse —
free-tier models reliably write natural prose but inconsistently escape quotes
inside JSON. A model that ignores the format entirely just chats normally and we
store nothing.

## Components

1. **`core/memory.ts`** (extend, pure)
   - `parseChatReply(raw: string): { reply: string; facts: string[] }`
     - Split `raw` on the first `<<FACTS>>` **substring** (not a whole line —
       free models emit it inline, e.g. `reply text <<FACTS>>["fact"]` with no
       surrounding newlines; line-based matching missed this and leaked the
       sentinel into the spoken reply).
     - No sentinel → `{ reply: raw.trim(), facts: [] }`.
     - Sentinel present → `reply` = text before (trimmed); attempt
       `JSON.parse` of the text after (trimmed).
     - Parse failure, non-array result, or non-string entries → those are dropped;
       on total parse failure return `facts: []` (reply still kept).
     - Trim each fact, drop empties.
   - `buildExtractionInstructions(): string` — the instruction block appended to
     the chat system prompt (see below). A constant function so it is unit-testable
     and reused.

2. **`core/persona.ts`** (extend)
   - `buildChatSystemPrompt(name, recall)` appends `buildExtractionInstructions()`.
   - Instructions tell the model: after replying, if the user revealed a durable
     fact or standing preference **not already in the list above**, append a
     `<<FACTS>>` line then a JSON array of short fact strings; otherwise output
     nothing extra; never mention the facts or the sentinel in the spoken reply;
     at most 3 facts per turn.

3. **`app/turn.ts`** (modify chat branch only)
   - Call `api.chat` as today (system prompt now carries extraction instructions).
   - `const { reply, facts } = parseChatReply(raw)`.
   - For each fact, store it via `memories.add` **unless** it case-insensitively
     matches an already-known fact (compare against the list already fetched for
     recall — no extra read). Cap at 3 stored per turn.
   - Return `{ kind: "chat", text: reply }` (facts stripped from spoken text).
   - Briefing / remember / capture branches unchanged.

## Data flow

```
user utterance
  → chat branch
  → system prompt = persona + buildRecall(existingFacts) + extraction instructions
  → api.chat → raw
  → parseChatReply(raw) → { reply, facts }
  → for each fact not in existingFacts (case-insensitive), capped at 3: memories.add
  → return { kind: "chat", text: reply }   // clean, spoken via TTS
```

## Error handling

- **Parse failure / no sentinel / malformed JSON:** reply kept verbatim, zero facts.
  The conversation never breaks because of extraction.
- **Bad fact entries:** non-string or empty entries skipped.
- **Dedup:** case-insensitive trimmed comparison against the already-known facts.
- **Per-turn cap:** at most 3 facts stored per turn, guarding against a runaway
  turn dumping many low-quality "facts".

## Testing

- `parseChatReply` unit tests:
  - clean reply + facts array
  - no sentinel → reply only, no facts
  - sentinel + empty array → reply, no facts
  - sentinel + malformed JSON → reply kept, no facts
  - facts with surrounding whitespace / empty strings → trimmed, empties dropped
- `turn.test`:
  - chat turn stores genuinely new facts
  - chat turn skips a fact that case-insensitively duplicates an existing one
  - returned `text` is the clean reply (sentinel/facts stripped)
  - parse-failure path stores nothing and returns the raw reply

## Deferred (YAGNI)

- Auto-superseding contradictory facts (keep-both for now).
- Confidence scoring / fact ranking.
- Extraction on capture and briefing turns.
- Fact tags / categories / structured fields.

## Constraints honored

- **Local-first privacy:** facts stay on device in the existing SQLite `memory`
  table; only the conversation text already sent for chat leaves the device.
- **Cost:** no additional LLM calls — extraction rides the existing chat call,
  respecting free-tier rate limits (matches the existing `turn.ts` ponytail note).
