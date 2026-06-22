# Graph View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th "Graph" tab showing every life-model entity as a force-directed "brain network," with edges derived from shared events, pan/zoom, and a tap-a-node detail screen to view, rename, or delete.

**Architecture:** New `LifeStore` reads (`allEntities`, `graphEdges`, `entityNeighbors`) + one write (`updateEntity`) over the existing entity/event/link SQLite tables — edges are derived from shared events, not stored. A pure-JS `d3-force` simulation (in a hook) lays out `react-native-svg` circles/lines/labels; core RN `PanResponder` handles pan + pinch-zoom. The graph animates as it settles on open/data-change, then freezes.

**Tech Stack:** TypeScript, Expo SDK 56 / React Native, expo-sqlite, `react-native-svg` (new native dep), `d3-force` (new pure-JS dep), Jest, pnpm. App in `app/` (own pnpm root) — run all commands from `app/`.

## Global Constraints

- Local-first: all reads over on-device SQLite. No new network egress.
- Entity types are exactly `"person" | "goal" | "fact"`.
- Edges are **derived** from shared events (two entities linked to the same `event` row) — no schema change, no stored entity↔entity links.
- New native dependency `react-native-svg` requires one `expo prebuild` + gradle rebuild before on-device verification (see [[bram-android-build]]). `d3-force` is pure JS (no rebuild).
- Install native deps with `pnpm expo install` (SDK-pinned version); pure deps with `pnpm add`.
- SQLite store impls are NOT unit-tested (expo-sqlite is native, unavailable in Jest) — they mirror the in-memory impl's contract and are verified on-device. In-memory impls carry the test coverage. UI/native screens are verified by `pnpm typecheck` + on-device, not Jest. This matches the existing codebase.
- `updateEntity` must reject a rename colliding with another entity of the same type (case-insensitive name) by throwing.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Tests: `pnpm test`; types: `pnpm typecheck`, both from `app/`.

---

### Task 1: LifeStore graph methods (interface + both impls + tests)

**Files:**
- Modify: `app/src/core/life-store.ts`
- Modify: `app/src/core/life-store-memory.ts`
- Modify: `app/src/db/sqlite-life-store.ts`
- Test: `app/__tests__/life-store-graph.test.ts` (create)

**Interfaces:**
- Consumes: `Entity`, `LifeEvent` from `core/types`; existing `LifeStore`.
- Produces (added to `LifeStore`):
  - `allEntities(): Promise<Entity[]>`
  - `graphEdges(): Promise<Array<[string, string]>>` — deduped undirected pairs, each ordered `a < b`.
  - `entityNeighbors(id: string): Promise<Entity[]>` — entities sharing ≥1 event with `id`, excluding `id`.
  - `updateEntity(id: string, name: string, attributes: Record<string, unknown> | null): Promise<Entity>` — throws on same-type case-insensitive name collision or unknown id.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/life-store-graph.test.ts`:

```ts
import { createInMemoryLifeStore } from "../src/core/life-store-memory";

const now = 1000;

describe("graphEdges", () => {
  it("connects two entities that share an event, ordered a<b, deduped", async () => {
    const store = createInMemoryLifeStore();
    const ana = await store.upsertEntity("person", "Ana", null, now, () => "ana");
    const ben = await store.upsertEntity("person", "Ben", null, now, () => "ben");
    const ev = await store.addEvent("dinner", null, now, () => "ev1");
    await store.link(ev.id, ana.id);
    await store.link(ev.id, ben.id);
    expect(await store.graphEdges()).toEqual([["ana", "ben"]]);
  });

  it("yields no edge for entities that share no event", async () => {
    const store = createInMemoryLifeStore();
    const ana = await store.upsertEntity("person", "Ana", null, now, () => "ana");
    const ben = await store.upsertEntity("person", "Ben", null, now, () => "ben");
    const e1 = await store.addEvent("solo a", null, now, () => "e1");
    const e2 = await store.addEvent("solo b", null, now, () => "e2");
    await store.link(e1.id, ana.id);
    await store.link(e2.id, ben.id);
    expect(await store.graphEdges()).toEqual([]);
  });

  it("ignores entity→entity links (only event from_ids count)", async () => {
    const store = createInMemoryLifeStore();
    const ana = await store.upsertEntity("person", "Ana", null, now, () => "ana");
    const ben = await store.upsertEntity("person", "Ben", null, now, () => "ben");
    await store.link(ana.id, ben.id); // not via an event
    expect(await store.graphEdges()).toEqual([]);
  });
});

describe("entityNeighbors", () => {
  it("returns co-event entities and excludes self and unrelated", async () => {
    const store = createInMemoryLifeStore();
    const ana = await store.upsertEntity("person", "Ana", null, now, () => "ana");
    const ben = await store.upsertEntity("person", "Ben", null, now, () => "ben");
    const cy = await store.upsertEntity("person", "Cy", null, now, () => "cy");
    const ev = await store.addEvent("dinner", null, now, () => "ev1");
    await store.link(ev.id, ana.id);
    await store.link(ev.id, ben.id);
    const names = (await store.entityNeighbors("ana")).map((e) => e.name);
    expect(names).toEqual(["Ben"]);
  });
});

describe("updateEntity", () => {
  it("renames an entity", async () => {
    const store = createInMemoryLifeStore();
    await store.upsertEntity("person", "Anna", null, now, () => "ana");
    const out = await store.updateEntity("ana", "Ana", null);
    expect(out.name).toBe("Ana");
    expect((await store.people())[0].name).toBe("Ana");
  });

  it("throws on a same-type case-insensitive name collision", async () => {
    const store = createInMemoryLifeStore();
    await store.upsertEntity("person", "Ana", null, now, () => "ana");
    await store.upsertEntity("person", "Ben", null, now, () => "ben");
    await expect(store.updateEntity("ben", "ana", null)).rejects.toThrow();
  });

  it("allows the same name across different types", async () => {
    const store = createInMemoryLifeStore();
    await store.upsertEntity("person", "Germany", null, now, () => "p");
    await store.upsertEntity("goal", "Trip", null, now, () => "g");
    const out = await store.updateEntity("g", "Germany", null);
    expect(out.name).toBe("Germany");
  });

  it("throws on unknown id", async () => {
    const store = createInMemoryLifeStore();
    await expect(store.updateEntity("nope", "X", null)).rejects.toThrow();
  });
});

describe("allEntities", () => {
  it("returns entities of every type", async () => {
    const store = createInMemoryLifeStore();
    await store.upsertEntity("person", "Ana", null, now, () => "p");
    await store.upsertEntity("goal", "Trip", null, now, () => "g");
    await store.upsertEntity("fact", "vegetarian", null, now, () => "f");
    expect((await store.allEntities()).map((e) => e.id).sort()).toEqual(["f", "g", "p"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test life-store-graph`
Expected: FAIL — `graphEdges`/`entityNeighbors`/`updateEntity`/`allEntities` are not functions.

- [ ] **Step 3: Add the methods to the `LifeStore` interface**

In `app/src/core/life-store.ts`, add inside the interface (after `deleteEntity`):

```ts
  allEntities(): Promise<Entity[]>;
  graphEdges(): Promise<Array<[string, string]>>;
  entityNeighbors(id: string): Promise<Entity[]>;
  updateEntity(id: string, name: string, attributes: Record<string, unknown> | null): Promise<Entity>;
```

- [ ] **Step 4: Implement them in the in-memory store**

In `app/src/core/life-store-memory.ts`, add these methods inside the returned object (after `deleteEntity`, before the closing `}`):

```ts
    async allEntities() {
      return [...entities];
    },
    async graphEdges() {
      const eventIds = new Set(events.map((e) => e.id));
      const byEvent = new Map<string, string[]>();
      for (const [from, to] of links) {
        if (eventIds.has(from)) {
          const arr = byEvent.get(from) ?? [];
          arr.push(to);
          byEvent.set(from, arr);
        }
      }
      const seen = new Set<string>();
      const out: Array<[string, string]> = [];
      for (const ents of byEvent.values()) {
        // ponytail: O(group²) pair scan; fine at personal scale (tens of entities)
        for (let i = 0; i < ents.length; i++) {
          for (let j = i + 1; j < ents.length; j++) {
            if (ents[i] === ents[j]) continue;
            const [a, b] = ents[i] < ents[j] ? [ents[i], ents[j]] : [ents[j], ents[i]];
            const key = `${a} ${b}`;
            if (!seen.has(key)) {
              seen.add(key);
              out.push([a, b]);
            }
          }
        }
      }
      return out;
    },
    async entityNeighbors(id) {
      const eventIds = new Set(events.map((e) => e.id));
      const myEvents = new Set(
        links.filter(([from, to]) => to === id && eventIds.has(from)).map(([from]) => from)
      );
      const neighborIds = new Set<string>();
      for (const [from, to] of links) {
        if (eventIds.has(from) && myEvents.has(from) && to !== id) neighborIds.add(to);
      }
      return entities.filter((e) => neighborIds.has(e.id));
    },
    async updateEntity(id, name, attributes) {
      const e = entities.find((x) => x.id === id);
      if (!e) throw new Error("updateEntity: entity not found");
      const key = name.trim().toLowerCase();
      const collision = entities.find(
        (x) => x.id !== id && x.type === e.type && x.name.toLowerCase() === key
      );
      if (collision) throw new Error("updateEntity: name already exists");
      e.name = name.trim();
      e.attributes = attributes;
      return e;
    },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test life-store-graph`
Expected: PASS (all cases).

- [ ] **Step 6: Implement them in the SQLite store**

In `app/src/db/sqlite-life-store.ts`, add these methods inside the returned object (after `deleteEntity`, before the closing `}`):

```ts
    async allEntities() {
      return (await db.getAllAsync<EntityRow>("SELECT * FROM entity ORDER BY type, name")).map(rowToEntity);
    },
    async graphEdges() {
      const rows = await db.getAllAsync<{ a: string; b: string }>(
        `SELECT DISTINCT l1.to_id AS a, l2.to_id AS b
         FROM link l1
         JOIN link l2 ON l1.from_id = l2.from_id AND l1.to_id < l2.to_id
         WHERE l1.from_id IN (SELECT id FROM event)`
      );
      return rows.map((r) => [r.a, r.b] as [string, string]);
    },
    async entityNeighbors(id) {
      return (await db.getAllAsync<EntityRow>(
        `SELECT DISTINCT e.* FROM entity e
         JOIN link l2 ON l2.to_id = e.id
         JOIN link l1 ON l1.from_id = l2.from_id
         WHERE l1.to_id = ? AND e.id != ? AND l1.from_id IN (SELECT id FROM event)`,
        [id, id]
      )).map(rowToEntity);
    },
    async updateEntity(id, name, attributes) {
      const rows = await db.getAllAsync<EntityRow>("SELECT * FROM entity WHERE id = ?", [id]);
      const row = rows[0];
      if (!row) throw new Error("updateEntity: entity not found");
      const key = name.trim().toLowerCase();
      const dup = await db.getAllAsync<EntityRow>(
        "SELECT id FROM entity WHERE type = ? AND lower(name) = ? AND id != ?",
        [row.type, key, id]
      );
      if (dup.length) throw new Error("updateEntity: name already exists");
      const attrJson = attributes ? JSON.stringify(attributes) : null;
      await db.runAsync("UPDATE entity SET name = ?, attributes = ? WHERE id = ?", [name.trim(), attrJson, id]);
      return rowToEntity({ ...row, name: name.trim(), attributes: attrJson });
    },
```

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/src/core/life-store.ts app/src/core/life-store-memory.ts app/src/db/sqlite-life-store.ts app/__tests__/life-store-graph.test.ts
git commit -m "feat(graph): add allEntities/graphEdges/entityNeighbors/updateEntity to LifeStore" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Dependencies + force-layout hook

**Files:**
- Modify: `app/package.json` (via install commands — do not hand-edit)
- Create: `app/src/ui/graph/use-graph-layout.ts`

**Interfaces:**
- Consumes: `Entity` from `core/types`; `d3-force`.
- Produces:
  - `interface GraphNode { id: string; type: EntityType; name: string; degree: number; x?: number; y?: number; }`
  - `useGraphLayout(entities: Entity[], edges: Array<[string,string]>, size: { width: number; height: number }): { nodes: GraphNode[] }`

- [ ] **Step 1: Install the dependencies**

Run (from `app/`):

```bash
pnpm expo install react-native-svg
pnpm add d3-force
pnpm add -D @types/d3-force
```

`react-native-svg` already appears in the jest `transformIgnorePatterns` (jest-expo default) — no jest config change needed. If pnpm reports an ignored build script for `react-native-svg`, it is not required for install (native code builds via gradle); leave `allowBuilds` unchanged.

- [ ] **Step 2: Verify the installs**

Run: `pnpm list react-native-svg d3-force`
Expected: both resolve to a version (react-native-svg SDK-56-compatible, e.g. 15.x).

- [ ] **Step 3: Write the layout hook**

Create `app/src/ui/graph/use-graph-layout.ts`:

```ts
import { useEffect, useRef, useState } from "react";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type Simulation,
} from "d3-force";
import type { Entity, EntityType } from "../../core/types";

export interface GraphNode {
  id: string;
  type: EntityType;
  name: string;
  degree: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

// Runs a d3-force simulation over the entities/edges, seeded on a circle so the
// first frame isn't a singularity. d3 ticks via requestAnimationFrame and stops
// itself once alpha decays (settle-then-freeze). We bump a counter each tick so
// React re-reads the mutated node positions.
export function useGraphLayout(
  entities: Entity[],
  edges: Array<[string, string]>,
  size: { width: number; height: number }
): { nodes: GraphNode[] } {
  const [, setTick] = useState(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);

  useEffect(() => {
    const degree = new Map<string, number>();
    for (const [a, b] of edges) {
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    }
    const cx = size.width / 2;
    const cy = size.height / 2;
    const r = Math.max(40, Math.min(cx, cy) * 0.7);
    const nodes: GraphNode[] = entities.map((e, i) => {
      const angle = (i / Math.max(1, entities.length)) * 2 * Math.PI;
      return {
        id: e.id,
        type: e.type,
        name: e.name,
        degree: degree.get(e.id) ?? 0,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
    nodesRef.current = nodes;
    const links: GraphLink[] = edges.map(([source, target]) => ({ source, target }));

    const sim = forceSimulation<GraphNode, GraphLink>(nodes)
      .force("charge", forceManyBody().strength(-140))
      .force("link", forceLink<GraphNode, GraphLink>(links).id((n) => n.id).distance(70))
      .force("center", forceCenter(cx, cy))
      .force("collide", forceCollide(24))
      .on("tick", () => setTick((t) => t + 1));
    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [entities, edges, size.width, size.height]);

  return { nodes: nodesRef.current };
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/pnpm-lock.yaml app/src/ui/graph/use-graph-layout.ts
git commit -m "feat(graph): add react-native-svg + d3-force and the force-layout hook" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Graph canvas screen

**Files:**
- Create: `app/src/screens/GraphScreen.tsx`

**Interfaces:**
- Consumes: `useServices().store` (`allEntities`, `graphEdges`); `useGraphLayout`, `GraphNode`; `react-native-svg`; theme.
- Produces: `function GraphScreen({ onSelect }: { onSelect: (entityId: string) => void }): JSX.Element`.

- [ ] **Step 1: Write the screen**

Create `app/src/screens/GraphScreen.tsx`:

```tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, PanResponder, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { G, Line, Circle, Text as SvgText } from "react-native-svg";
import { useServices } from "../app/services";
import { useGraphLayout } from "../ui/graph/use-graph-layout";
import type { Entity, EntityType } from "../core/types";
import { Screen } from "../ui/Screen";
import { colors, font, space } from "../ui/theme";

const NODE_COLOR: Record<EntityType, string> = {
  person: colors.accent,
  goal: colors.reminder,
  fact: colors.task,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function GraphScreen({ onSelect }: { onSelect: (entityId: string) => void }) {
  const { store } = useServices();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [edges, setEdges] = useState<Array<[string, string]>>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    store.allEntities().then(setEntities);
    store.graphEdges().then(setEdges);
  }, [store]);

  const { nodes } = useGraphLayout(entities, edges, size);
  const pos = new Map(nodes.map((n) => [n.id, n]));

  // Pan + pinch-zoom on the whole canvas. Taps (no movement) fall through to a
  // node's onPress. ponytail: pinch scales about the origin, not the focal
  // point — acceptable for a brain map; upgrade to gesture-handler if it grates.
  const t = useRef({ x: 0, y: 0, scale: 1 });
  const start = useRef({ x: 0, y: 0, scale: 1, dist: 0 });
  const [, force] = useState(0);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.hypot(g.dx, g.dy) > 4 || g.numberActiveTouches === 2,
      onPanResponderGrant: () => {
        start.current = { x: t.current.x, y: t.current.y, scale: t.current.scale, dist: 0 };
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          const d = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          );
          if (!start.current.dist) start.current.dist = d;
          t.current.scale = clamp(start.current.scale * (d / start.current.dist), 0.3, 3);
        } else {
          t.current.x = start.current.x + g.dx;
          t.current.y = start.current.y + g.dy;
        }
        force((n) => n + 1);
      },
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  if (entities.length === 0) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Bram hasn't learned anything yet — talk to me.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.canvas} onLayout={onLayout} {...pan.panHandlers}>
        <Svg width="100%" height="100%">
          <G transform={`translate(${t.current.x},${t.current.y}) scale(${t.current.scale})`}>
            {edges.map(([a, b], i) => {
              const na = pos.get(a);
              const nb = pos.get(b);
              if (!na || !nb) return null;
              return (
                <Line
                  key={i}
                  x1={na.x}
                  y1={na.y}
                  x2={nb.x}
                  y2={nb.y}
                  stroke={colors.hairline}
                  strokeWidth={1}
                />
              );
            })}
            {nodes.map((n) => (
              <React.Fragment key={n.id}>
                <Circle
                  cx={n.x}
                  cy={n.y}
                  r={clamp(8 + n.degree * 2, 8, 22)}
                  fill={NODE_COLOR[n.type]}
                  onPress={() => onSelect(n.id)}
                />
                <SvgText
                  x={n.x}
                  y={(n.y ?? 0) + clamp(8 + n.degree * 2, 8, 22) + 12}
                  fill={colors.muted}
                  fontSize={10}
                  textAnchor="middle"
                >
                  {n.name}
                </SvgText>
              </React.Fragment>
            ))}
          </G>
        </Svg>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: colors.base },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  emptyText: { color: colors.muted, fontSize: font.body, textAlign: "center", lineHeight: 22 },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/GraphScreen.tsx
git commit -m "feat(graph): add the force-directed graph canvas screen" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Node detail screen (view / rename / delete)

**Files:**
- Create: `app/src/screens/NodeDetailScreen.tsx`

**Interfaces:**
- Consumes: `useServices().store` (`allEntities`, `eventsForEntity`, `entityNeighbors`, `updateEntity`, `deleteEntity`); theme; UI primitives (`Screen`, `Section`, `Card`).
- Produces: `function NodeDetailScreen({ entityId, onBack, onNavigate }: { entityId: string; onBack: () => void; onNavigate: (id: string) => void }): JSX.Element`.

- [ ] **Step 1: Write the screen**

Create `app/src/screens/NodeDetailScreen.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View, Pressable, StyleSheet } from "react-native";
import { useServices } from "../app/services";
import type { Entity, LifeEvent } from "../core/types";
import { Screen } from "../ui/Screen";
import { Section } from "../ui/Section";
import { Card } from "../ui/Card";
import { colors, font, radius, space } from "../ui/theme";

export function NodeDetailScreen({
  entityId,
  onBack,
  onNavigate,
}: {
  entityId: string;
  onBack: () => void;
  onNavigate: (id: string) => void;
}) {
  const { store } = useServices();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [name, setName] = useState("");
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [neighbors, setNeighbors] = useState<Entity[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const all = await store.allEntities();
      const e = all.find((x) => x.id === entityId) ?? null;
      if (!active) return;
      setEntity(e);
      setName(e?.name ?? "");
      setEvents(await store.eventsForEntity(entityId));
      setNeighbors(await store.entityNeighbors(entityId));
    })();
    return () => {
      active = false;
    };
  }, [store, entityId]);

  const save = async () => {
    if (!entity) return;
    setError("");
    try {
      const updated = await store.updateEntity(entity.id, name, entity.attributes);
      setEntity(updated);
    } catch {
      setError("That name is already taken.");
    }
  };

  const remove = async () => {
    if (!entity) return;
    await store.deleteEntity(entity.id);
    onBack();
  };

  const dirty = entity != null && name.trim() !== "" && name.trim() !== entity.name;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back to graph">
          <Text style={styles.back}>‹ Graph</Text>
        </Pressable>

        {!entity ? (
          <Text style={styles.empty}>Not found.</Text>
        ) : (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{entity.name}</Text>
              <Text style={styles.chip}>{entity.type}</Text>
            </View>

            <Section title="Rename">
              <Card>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  accessibilityLabel="entity name"
                  style={styles.input}
                  placeholderTextColor={colors.muted}
                />
                {error !== "" && <Text style={styles.error}>{error}</Text>}
                <Pressable
                  onPress={save}
                  disabled={!dirty}
                  style={[styles.button, !dirty && styles.buttonOff]}
                  accessibilityLabel="Save name"
                >
                  <Text style={styles.buttonText}>Save</Text>
                </Pressable>
              </Card>
            </Section>

            <Section title="Events">
              <Card>
                {events.length === 0 ? (
                  <Text style={styles.empty}>No events yet.</Text>
                ) : (
                  events.map((ev, i) => (
                    <Text key={ev.id} style={[styles.row, i > 0 && styles.divider]}>
                      {ev.text}
                    </Text>
                  ))
                )}
              </Card>
            </Section>

            <Section title="Connected">
              <Card>
                {neighbors.length === 0 ? (
                  <Text style={styles.empty}>Nothing connected yet.</Text>
                ) : (
                  neighbors.map((nb, i) => (
                    <Pressable
                      key={nb.id}
                      onPress={() => onNavigate(nb.id)}
                      style={[styles.row, i > 0 && styles.divider]}
                      accessibilityLabel={`Open ${nb.name}`}
                    >
                      <Text style={styles.link}>{nb.name}</Text>
                    </Pressable>
                  ))
                )}
              </Card>
            </Section>

            <Pressable onPress={remove} style={styles.delete} accessibilityLabel="Delete entity">
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.xl, paddingBottom: space.xl },
  back: { color: colors.accent, fontSize: font.body, marginBottom: space.lg },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: space.xl },
  title: { color: colors.text, fontSize: font.display, fontWeight: font.weight.bold, flex: 1 },
  chip: {
    color: colors.muted,
    fontSize: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    overflow: "hidden",
  },
  input: {
    color: colors.text,
    fontSize: font.body,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginBottom: space.md,
  },
  error: { color: colors.reminder, fontSize: 12, marginBottom: space.md },
  button: { backgroundColor: colors.accent, borderRadius: radius.card, paddingVertical: space.md, alignItems: "center" },
  buttonOff: { backgroundColor: colors.hairline },
  buttonText: { color: colors.text, fontWeight: font.weight.semibold, fontSize: font.body },
  row: { color: colors.text, fontSize: font.body, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  link: { color: colors.accent, fontSize: font.body },
  empty: { color: colors.muted, fontSize: font.body },
  delete: { marginTop: space.xl, paddingVertical: space.md, alignItems: "center" },
  deleteText: { color: colors.reminder, fontSize: font.body, fontWeight: font.weight.semibold },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/NodeDetailScreen.tsx
git commit -m "feat(graph): add node detail screen with view/rename/delete" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Wire the Graph tab into navigation

**Files:**
- Modify: `app/src/ui/TabBar.tsx`
- Modify: `app/App.tsx`

**Interfaces:**
- Consumes: `GraphScreen`, `NodeDetailScreen`.
- Produces: `Tab` union now includes `"graph"`; the graph tab renders `GraphScreen` or `NodeDetailScreen` based on a `graphSel` state.

- [ ] **Step 1: Add the tab to `TabBar.tsx`**

In `app/src/ui/TabBar.tsx`, change the `Tab` type:

```ts
export type Tab = "talk" | "agenda" | "graph" | "settings";
```

and add an `ITEMS` entry between `agenda` and `settings`:

```ts
  { key: "agenda", icon: "calendar", label: "Agenda" },
  { key: "graph", icon: "git-network", label: "Graph" },
  { key: "settings", icon: "settings", label: "Settings" },
```

- [ ] **Step 2: Wire the screens into `App.tsx`**

In `app/App.tsx`, add the imports:

```tsx
import { GraphScreen } from "./src/screens/GraphScreen";
import { NodeDetailScreen } from "./src/screens/NodeDetailScreen";
```

add the selection state next to `const [tab, setTab] = useState<Tab>("talk");`:

```tsx
  const [graphSel, setGraphSel] = useState<string | null>(null);
```

and add the graph branch in the body, after the `agenda` line:

```tsx
          {tab === "graph" &&
            (graphSel ? (
              <NodeDetailScreen entityId={graphSel} onBack={() => setGraphSel(null)} onNavigate={setGraphSel} />
            ) : (
              <GraphScreen onSelect={setGraphSel} />
            ))}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: all suites pass (existing + `life-store-graph`).

- [ ] **Step 5: Commit**

```bash
git add app/src/ui/TabBar.tsx app/App.tsx
git commit -m "feat(graph): add Graph tab and wire canvas/detail navigation" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Native rebuild + on-device verification

**Files:** none (build + manual verification).

**Interfaces:** none.

- [ ] **Step 1: Rebuild the dev client with the new native module**

`react-native-svg` is native, so the existing dev build must be regenerated (see [[bram-android-build]]). Run (from `app/`, Android emulator running):

```bash
pnpm exec expo prebuild --platform android
pnpm exec expo run:android
```

Expected: build succeeds, app launches on the emulator.

- [ ] **Step 2: Verify the graph on-device**

Walk this checklist on the emulator:

- The 4th "Graph" tab appears between Agenda and Settings.
- With an empty DB: the empty state ("Bram hasn't learned anything yet…") shows.
- After teaching Bram a person + an event mentioning them (via Talk), reopening Graph shows colored nodes with at least one connecting edge; the layout animates briefly then settles/freezes.
- One-finger drag pans; two-finger pinch zooms (0.3×–3×).
- Tapping a node opens the detail screen with its events and connected entities.
- Rename → Save updates the name (and renaming to an existing same-type name shows "That name is already taken.").
- Tapping a connected entity navigates to that node's detail.
- Delete removes the node; returning to the graph no longer shows it or its edges.

- [ ] **Step 3: Note the result**

Record pass/fail of the checklist in the session. No commit (no code change). If a defect is found, open a follow-up task rather than patching ad hoc.

---

## Self-Review

**Spec coverage:**
- Graph shape (entities=nodes, shared-event edges) → Task 1 `graphEdges` + Task 3 render. ✓
- Rendering react-native-svg + d3-force, PanResponder pan/zoom → Tasks 2–3. ✓
- Settle-then-freeze animation → Task 2 hook (d3 auto-stop). ✓
- Color by type, size by degree, orphan nodes render → Task 3. ✓
- Tap → detail with view/rename/delete → Task 4. ✓ `updateEntity` collision guard → Task 1. ✓
- Connected-entities navigation → Task 4 `entityNeighbors` + `onNavigate`. ✓
- Empty state → Task 3. ✓
- New tab + nav → Task 5. ✓
- One native rebuild → Task 6. ✓
- **Divergence from spec (flagged):** node-drag-to-reposition / drag-to-reheat is **deferred** (raw PanResponder makes canvas-pan + node-drag conflict-prone). Settle-then-freeze on open/data-change is preserved. Moved to Deferred below.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". All code blocks complete. ✓

**Type consistency:** `GraphNode` (id/type/name/degree/x/y) defined in Task 2, consumed in Task 3. `graphEdges(): Array<[string,string]>` consistent across interface (Task 1), hook (Task 2), screen (Task 3). `updateEntity(id, name, attributes)` signature identical across interface, both impls (Task 1), and caller (Task 4). `onSelect`/`onBack`/`onNavigate` props match between Tasks 3/4 and the wiring in Task 5. ✓

## Deferred (YAGNI)

- Node-drag-to-reposition and drag-to-reheat the simulation.
- Pinch focal-point preservation (zooms about origin).
- Edge labels on canvas; zoom-based label decluttering.
- In-graph search / filter / type toggles; merge two entities.
- Editing attributes in the detail screen (rename only for v1).
- A `getEntity(id)` store method (detail screen reuses `allEntities().find`).
