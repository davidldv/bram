# Graph view ("brain network") tab design

**Date:** 2026-06-22
**Status:** Approved (design)

## Problem

The life-model ([[2026-06-22-life-model-design]]) now stores people, goals, facts,
events, and links, but the only window onto it is Settings → "What Bram knows", a
flat list. Bram should let the user *see* what it has learned as a connected
graph — an Obsidian-style "brain network" — and tap any node to inspect, rename,
or delete it. This is both a useful correctness tool (spot wrong/duplicated
entities) and the most visual demonstration that the **system**, not the model,
is the product.

This is the first of the planned views over the life-model. Timeline / People DB /
Goals / Home dashboard / proactive check-ins remain separate later specs.

## Scope

In scope: a 4th "Graph" tab; a force-directed graph of all entities with edges
derived from shared events; pan/zoom; tap-a-node detail screen with view + rename
+ delete; the new `LifeStore` reads/writes those need; an empty state.

Out of scope (separate specs / deferred): the literal "open a .md file you edit"
(replaced by a structured detail screen — more reliable than markdown
round-tripping); edge labels on the canvas; in-graph search/filter; merging two
entities; model-emitted entity↔entity links; the other view tabs.

## Decisions (locked)

- **Graph shape:** entities are nodes; an edge connects two entities that **share
  at least one event**. Events are not nodes — they live inside a node's detail.
- **Rendering:** `react-native-svg` (nodes = `<Circle>`, edges = `<Line>`,
  labels = `<Text>`) + `d3-force` (pure-JS physics) for layout. Pan/zoom via core
  RN `PanResponder` — **no** gesture-handler dep.
- **Animation:** physics runs on open / data-change, animates as it settles
  (~2 s), then **freezes** to save battery. Dragging a node re-energizes the
  simulation briefly (Obsidian-like), no perpetual wobble.
- **Tap a node → detail:** view its events + connected entities, **rename**, and
  **delete**. Rename is the mapping of the user's "edit the .md" idea.
- **Node visuals:** color by type (person / goal / fact); radius by **degree**
  (number of connected entities), computed in JS from the edge list — no extra
  query. Orphan nodes (degree 0) still render, floating.
- **Local-first:** pure on-device reads over SQLite. No new network egress.

## Cost

One new **native** dependency (`react-native-svg`) → one `expo prebuild` + gradle
rebuild on the emulator (tooling already established, see [[bram-android-build]]).
`d3-force` is pure JS (no native). Everything else is JS and hot-reloads.

## Architecture

```
Graph tab open
  → store.allEntities()            → nodes
  → store.graphEdges()             → [entityId, entityId] pairs (shared-event)
  → useGraphLayout(nodes, edges)   → d3-force sim → {id → {x,y}}, settles then stops
  → <Svg> with PanResponder transform: <Line>s under <Circle>s under <Text> labels
  → tap node → NodeDetail(entityId)
                 → store.eventsForEntity(id)  (events list)
                 → store.entityNeighbors(id)  (connected entities)
                 → rename: store.updateEntity(id, name, attrs)  (collision-guarded)
                 → delete: store.deleteEntity(id)  (already exists)
```

## New `LifeStore` methods (interface + SQLite + in-memory impls)

```ts
allEntities(): Promise<Entity[]>;                 // every node, any type
graphEdges(): Promise<Array<[string, string]>>;   // entity-entity pairs, deduped, a<b
entityNeighbors(id: string): Promise<Entity[]>;   // entities sharing an event with id
updateEntity(                                      // rename / edit attrs; throws on (type,name) collision
  id: string, name: string,
  attributes: Record<string, unknown> | null
): Promise<Entity>;
```

`graphEdges()` SQL — self-join the `link` table on a shared **event** `from_id`:

```sql
SELECT DISTINCT l1.to_id AS a, l2.to_id AS b
FROM link l1
JOIN link l2 ON l1.from_id = l2.from_id AND l1.to_id < l2.to_id
WHERE l1.from_id IN (SELECT id FROM event);
```

`entityNeighbors(id)` — the same join filtered to one side = `id`. In-memory impls
mirror both by scanning links grouped by `from_id`. (Direct entity→entity links
aren't created yet — life-model deferred them — so v1 derives edges from shared
events only; if/when direct links exist, `UNION` them in.)

`updateEntity` rejects a rename that would collide with another entity of the same
type (case-insensitive `name`) by throwing; the detail screen catches and shows a
message. `upsertEntity` can't do this — it dedups by `(type, lower(name))` and so
would silently merge rather than rename.

## Components

### 1. Layout (`ui/graph/use-graph-layout.ts`, new)

Hook: `useGraphLayout(nodes, edges) → { positions: Map<id,{x,y}>, onDragNode }`.
Builds a `d3-force` simulation (`forceManyBody` repulsion, `forceLink` on edges,
`forceCenter`), ticks via `requestAnimationFrame` into React state, and
`simulation.stop()`s once `alpha` drops below the default threshold (settled).
`onDragNode(id, x, y)` fixes a node (`fx/fy`) and calls `simulation.alphaTarget`
to reheat, releasing on drag-end. Initial positions seeded on a circle so the
first frame isn't a singularity.

`ponytail`: d3-force is O(n log n)/tick (Barnes-Hut quadtree) — fine for the tens
to low-hundreds of entities a personal life-model holds. Cap or virtualize only if
a model ever reaches thousands of nodes.

### 2. Graph canvas (`ui/GraphScreen.tsx`, new)

`<Svg>` filling the screen. A `PanResponder` tracks one-finger drag → translate and
two-finger pinch (distance ratio) → scale, applied as a `<G transform>` on the root
group. Renders, back-to-front: `<Line>` per edge, `<Circle>` per node (fill by
type, r by degree), `<Text>` label per node (small, centered). Tapping a node
(short press, low movement) → `onSelect(entityId)`. Empty state when
`allEntities()` is empty: centered "Bram hasn't learned anything yet — talk to me."

`ponytail`: labels always render small; defer zoom-based label decluttering until
density is actually a problem.

### 3. Node detail (`ui/NodeDetailScreen.tsx`, new)

Header = entity name + type chip. Sections: **Events** (`eventsForEntity`, newest
first), **Connected** (`entityNeighbors`, tap to navigate to that node). A
`TextInput` pre-filled with the name + Save → `updateEntity` (catch collision →
inline error). A Delete button → confirm → `deleteEntity`, then pop back to the
graph (which re-reads). Editable attributes deferred; v1 renames the `name` only,
attributes passed through unchanged.

### 4. Navigation (`ui/TabBar.tsx` + `App.tsx`)

Add `"graph"` to the `Tab` union and an `ITEMS` entry (Ionicons
`git-network`/`share-social`, label "Graph"); order Talk · Agenda · **Graph** ·
Settings. `App.tsx` adds the graph branch and holds `selectedEntityId` to swap
between `GraphScreen` and `NodeDetailScreen` within the tab; the store comes from
`useServices()`.

## Error handling

- Empty model → explicit empty state, never a blank canvas.
- `updateEntity` collision → throws; detail screen shows inline error, no write.
- Delete → confirm dialog; on success re-read so the canvas reflects removal
  (orphan links already dropped by `deleteEntity`).
- Layout never blocks the UI thread beyond a rAF tick; sim stops when settled.

## Testing

Pure / store logic unit-tested (native SVG + d3 sim are device-verified, not
Jest-tested — native module unavailable in Jest, consistent with prior screens):

- `graphEdges`: SQLite vs in-memory **parity**; two entities sharing an event →
  one undirected pair (deduped, `a<b`); no self-pair; no pair for entities that
  share no event; orphan entity yields no edge.
- `entityNeighbors`: returns the co-event entity, excludes self, excludes
  unrelated.
- `updateEntity`: renames; bumps nothing it shouldn't; **throws on same-type
  case-insensitive name collision**; allows same name across different types.
- `allEntities`: returns every type; parity across impls.
- degree-sizing helper (if extracted pure): degree counted from the edge list.

Device-verified (manual E2E): tab appears; graph renders with colored nodes +
edges; pan + pinch-zoom; settle-then-freeze; tap → detail; rename reflects on the
canvas; delete removes node + edges; empty state on a fresh DB.

## Deferred (YAGNI)

- Literal markdown file open/edit (structured detail screen instead).
- Edge labels on canvas; zoom-based label decluttering.
- In-graph search / filter / type toggles.
- Merge two entities into one.
- Model-emitted entity↔entity links (still derived via shared events only).
- Editing attributes in the detail screen (rename only for v1).
- Continuous/idle physics (settle-then-freeze only).
