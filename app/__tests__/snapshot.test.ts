import {
  serialize,
  restore,
  buildInsert,
  TABLES,
  SCHEMA_VERSION,
  type SnapshotDb,
  type Row,
  type TableName,
} from "../src/sync/snapshot";

function memDb(seed: Partial<Record<TableName, Row[]>> = {}): SnapshotDb & { data: Record<TableName, Row[]> } {
  const data = {} as Record<TableName, Row[]>;
  for (const t of TABLES) data[t] = seed[t] ? [...seed[t]!] : [];
  return {
    data,
    async all(t) { return [...data[t]]; },
    async replaceAll(tables) { for (const t of TABLES) data[t] = [...(tables[t] ?? [])]; },
  };
}

describe("snapshot", () => {
  it("serialize captures every table and the schema version", async () => {
    const db = memDb({ entity: [{ id: "e1", name: "Ana", type: "person", attributes: null, last_mentioned_at: 2, created_at: 1 }] });
    const snap = await serialize(db);
    expect(snap.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Object.keys(snap.tables).sort()).toEqual([...TABLES].sort());
    expect(snap.tables.entity).toHaveLength(1);
    expect(snap.tables.event).toEqual([]);
  });

  it("restore replaces all rows from the snapshot", async () => {
    const db = memDb({ plan: [{ id: "old", type: "task", title: "old", scheduled_at: null, created_at: 1, done: 0 }] });
    await restore(db, {
      schemaVersion: SCHEMA_VERSION,
      tables: { ...emptyTables(), plan: [{ id: "new", type: "task", title: "new", scheduled_at: null, created_at: 9, done: 1 }] },
    });
    expect(db.data.plan).toEqual([{ id: "new", type: "task", title: "new", scheduled_at: null, created_at: 9, done: 1 }]);
  });

  it("serialize -> restore round-trips through a fresh db", async () => {
    const src = memDb({ memory: [{ id: "m1", text: "hi", created_at: 3 }] });
    const snap = await serialize(src);
    const dst = memDb();
    await restore(dst, snap);
    expect(dst.data.memory).toEqual([{ id: "m1", text: "hi", created_at: 3 }]);
  });

  it("buildInsert produces parameterized SQL in column order", () => {
    const row: Row = { id: "e1", type: "person", name: "Ana", attributes: null, last_mentioned_at: 2, created_at: 1 };
    expect(buildInsert("entity", row)).toEqual({
      sql: "INSERT INTO entity (id, type, name, attributes, last_mentioned_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      params: ["e1", "person", "Ana", null, 2, 1],
    });
  });
});

function emptyTables(): Record<TableName, Row[]> {
  const t = {} as Record<TableName, Row[]>;
  for (const name of TABLES) t[name] = [];
  return t;
}
