import { createBackup, type BackupTable, type MetaStore } from "../src/sync/backup";
import { open } from "../src/sync/envelope";
import { serialize, TABLES, type Row, type TableName, type SnapshotDb } from "../src/sync/snapshot";

function memDb(seed: Partial<Record<TableName, Row[]>> = {}): SnapshotDb & { data: Record<TableName, Row[]> } {
  const data = {} as Record<TableName, Row[]>;
  for (const t of TABLES) data[t] = seed[t] ? [...seed[t]!] : [];
  return {
    data,
    async all(t) { return [...data[t]]; },
    async replaceAll(tables) { for (const t of TABLES) data[t] = [...(tables[t] ?? [])]; },
  };
}

function fakeTable(initial: { ciphertext: string; version: number; schema_version: number } | null = null) {
  let row = initial;
  const table: BackupTable = {
    async read() { return row ? { ...row } : null; },
    async insert(r) {
      if (row) return "conflict";
      row = { ciphertext: r.ciphertext, schema_version: r.schema_version, version: 1 };
      return { version: 1 };
    },
    async updateIfVersion(expected, r) {
      if (!row || row.version !== expected) return "conflict";
      row = { ciphertext: r.ciphertext, schema_version: r.schema_version, version: expected + 1 };
      return { version: expected + 1 };
    },
  };
  return { table, peek: () => row };
}

function memMeta(): MetaStore {
  let m = { lastSyncedVersion: null as number | null, lastBackupAt: null as number | null };
  return { async get() { return { ...m }; }, async set(next) { m = { ...next }; } };
}

const key = new Uint8Array(32).fill(5);
const seq = (n: number) => new Uint8Array(n).map((_, i) => (i + 1) & 0xff);
const deps = (over: Partial<Parameters<typeof createBackup>[0]> = {}) => ({
  db: memDb(),
  table: fakeTable().table,
  getUserKey: async () => key,
  randomBytes: seq,
  meta: memMeta(),
  now: () => 1000,
  ...over,
});

describe("backup core", () => {
  it("backupNow inserts the first backup and persists meta", async () => {
    const t = fakeTable();
    const db = memDb({ memory: [{ id: "m1", text: "hi", created_at: 3 }] });
    const meta = memMeta();
    const b = createBackup(deps({ db, table: t.table, meta }));
    const res = await b.backupNow();
    expect(res).toEqual({ ok: true, version: 1 });
    expect(open(key, t.peek()!.ciphertext)).toEqual(await serialize(db));
    expect(await meta.get()).toEqual({ lastSyncedVersion: 1, lastBackupAt: 1000 });
  });

  it("backupNow returns conflict when the remote version moved", async () => {
    const t = fakeTable({ ciphertext: "00", version: 2, schema_version: 1 });
    const meta = memMeta();
    await meta.set({ lastSyncedVersion: 1, lastBackupAt: 1 }); // device thinks it's at v1, remote is v2
    const b = createBackup(deps({ table: t.table, meta }));
    expect(await b.backupNow()).toEqual({ conflict: true });
  });

  it("backupNow force overwrites past the guard", async () => {
    const t = fakeTable({ ciphertext: "00", version: 2, schema_version: 1 });
    const meta = memMeta();
    await meta.set({ lastSyncedVersion: 1, lastBackupAt: 1 });
    const b = createBackup(deps({ table: t.table, meta }));
    expect(await b.backupNow({ force: true })).toEqual({ ok: true, version: 3 });
  });

  it("restoreNow applies the snapshot and records the version", async () => {
    const src = memDb({ memory: [{ id: "m1", text: "hi", created_at: 3 }] });
    const t = fakeTable();
    await createBackup(deps({ db: src, table: t.table, meta: memMeta() })).backupNow();
    const dst = memDb();
    const meta = memMeta();
    const res = await createBackup(deps({ db: dst, table: t.table, meta })).restoreNow();
    expect(res).toEqual({ ok: true });
    expect(dst.data.memory).toEqual([{ id: "m1", text: "hi", created_at: 3 }]);
    expect((await meta.get()).lastSyncedVersion).toBe(1);
  });

  it("restoreNow returns empty when there's no remote backup", async () => {
    expect(await createBackup(deps()).restoreNow()).toEqual({ empty: true });
  });

  it("restoreNow refuses a newer schema_version", async () => {
    const t = fakeTable({ ciphertext: "00", version: 1, schema_version: 99 });
    const res = await createBackup(deps({ table: t.table })).restoreNow();
    expect(res).toMatchObject({ error: expect.stringMatching(/newer version/i) });
  });

  it("returns an error when signed out (no userKey)", async () => {
    const b = createBackup(deps({ getUserKey: async () => null }));
    expect(await b.backupNow()).toMatchObject({ error: expect.any(String) });
    expect(await b.restoreNow()).toMatchObject({ error: expect.any(String) });
  });
});
