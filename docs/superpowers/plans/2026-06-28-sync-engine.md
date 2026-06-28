# Encrypted Backup & Sync Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user back up the whole local SQLite life-model to Supabase, end-to-end encrypted with their `userKey`, and restore it on another device — manual buttons, with a guard-and-warn check against clobbering a newer backup.

**Architecture:** A pure crypto envelope (`seal`/`open`) wraps a JSON snapshot of every table; a pure `backup.ts` core orchestrates serialize → encrypt → push / pull → decrypt → restore over small ports (`SnapshotDb`, `BackupTable`, `MetaStore`); thin device adapters implement those ports against `expo-sqlite`, `@supabase/supabase-js`, and `expo-secure-store`. The server stores one versioned ciphertext row guarded by RLS and optimistic concurrency.

**Tech Stack:** Expo SDK 56, React Native 0.85.3, React 19.2.3, TypeScript ~6.0.3, jest-expo. Reuses `@noble/ciphers`/`@noble/hashes`, `@supabase/supabase-js`, `expo-secure-store`, `expo-crypto` (all already installed). No new dependencies.

## Global Constraints

- **Zero-knowledge:** Supabase stores only `ciphertext` (hex of `nonce ‖ XChaCha20-Poly1305(userKey, snapshot-json)`), the integer `version`, and `schema_version`. `userKey` and plaintext never leave the device. Every task preserves this.
- **`SCHEMA_VERSION = 1`.** Restore refuses a backup whose `schema_version` is greater than `SCHEMA_VERSION`.
- **Tables synced (whitelist):** `TABLES = ["entity", "event", "link", "plan", "preference", "news_topic", "memory"]`. No FKs, so insert order is irrelevant.
- **Tests live in `app/__tests__/*.test.ts(x)`** (jest preset `jest-expo`); run from `app/`. Pure modules import noble via the **`.js`** subpath (noble v2). Compare `Uint8Array` with `Array.from(...)` (no `Buffer` — tsconfig `types: ["jest"]`).
- **Encoding:** ciphertext is **hex** (`@noble/hashes/utils.js`). No base64 dependency.
- **Ports owned by the core:** `SnapshotDb` is defined in `snapshot.ts`; `BackupTable` and `MetaStore` are defined in `backup.ts`. Device adapters implement them; the core is tested with in-memory fakes.
- **Commit trailer:** end every commit with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Branch: `feat/sync-engine` (already created; spec already committed).
- ponytail active: mark deliberate shortcuts with a `// ponytail:` comment naming the ceiling + upgrade path. Never weaken the zero-knowledge invariant.

---

### Task 1: Crypto envelope (seal/open)

**Files:**
- Create: `app/src/sync/envelope.ts`
- Test: `app/__tests__/envelope.test.ts`

**Interfaces:**
- Produces:
  - `seal(userKey: Uint8Array, value: unknown, nonce: Uint8Array): string` — hex of `nonce ‖ ciphertext`, ciphertext = XChaCha20-Poly1305 over `utf8(JSON.stringify(value))`.
  - `open(userKey: Uint8Array, blob: string): unknown` — `JSON.parse` of the decrypted bytes; throws on wrong key or tampered blob.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/envelope.test.ts`:
```ts
import { seal, open } from "../src/sync/envelope";

const key = (f: number) => new Uint8Array(32).fill(f);
const nonce = new Uint8Array(24).fill(1);

describe("envelope", () => {
  it("seal/open round-trips a JSON value", () => {
    const value = { a: 1, b: ["x", "y"], c: { d: null } };
    expect(open(key(7), seal(key(7), value, nonce))).toEqual(value);
  });

  it("open throws on the wrong key", () => {
    const blob = seal(key(7), { a: 1 }, nonce);
    expect(() => open(key(8), blob)).toThrow();
  });

  it("open throws on a tampered blob", () => {
    const blob = seal(key(7), { a: 1 }, nonce);
    const flipped = blob.slice(0, -1) + (blob.endsWith("0") ? "1" : "0");
    expect(() => open(key(7), flipped)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `app/`): `pnpm exec jest __tests__/envelope.test.ts`
Expected: FAIL — `Cannot find module '../src/sync/envelope'`.

- [ ] **Step 3: Implement envelope.ts**

Create `app/src/sync/envelope.ts`:
```ts
// Pure AEAD envelope over a JSON value. Same primitive as the key wrapping in
// auth/crypto.ts. noble v2 needs the ".js" subpath.
import { utf8ToBytes, bytesToHex, hexToBytes, concatBytes } from "@noble/hashes/utils.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";

const NONCE_LEN = 24;

export function seal(userKey: Uint8Array, value: unknown, nonce: Uint8Array): string {
  const ct = xchacha20poly1305(userKey, nonce).encrypt(utf8ToBytes(JSON.stringify(value)));
  return bytesToHex(concatBytes(nonce, ct));
}

export function open(userKey: Uint8Array, blob: string): unknown {
  const raw = hexToBytes(blob);
  const pt = xchacha20poly1305(userKey, raw.slice(0, NONCE_LEN)).decrypt(raw.slice(NONCE_LEN));
  return JSON.parse(new TextDecoder().decode(pt));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `app/`): `pnpm exec jest __tests__/envelope.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/sync/envelope.ts app/__tests__/envelope.test.ts
git commit -m "feat(sync): encrypted JSON envelope (seal/open)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Snapshot serialize/restore + buildInsert

**Files:**
- Create: `app/src/sync/snapshot.ts`
- Test: `app/__tests__/snapshot.test.ts`

**Interfaces:**
- Produces:
  - `SCHEMA_VERSION = 1`
  - `TABLES` (the 7-name tuple) and `type TableName`
  - `type Row = Record<string, string | number | null>`
  - `interface Snapshot { schemaVersion: number; tables: Record<TableName, Row[]> }`
  - `interface SnapshotDb { all(table: TableName): Promise<Row[]>; replaceAll(tables: Record<TableName, Row[]>): Promise<void> }`
  - `serialize(db: SnapshotDb): Promise<Snapshot>`
  - `restore(db: SnapshotDb, snap: Snapshot): Promise<void>`
  - `buildInsert(table: TableName, row: Row): { sql: string; params: (string | number | null)[] }`

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/snapshot.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `app/`): `pnpm exec jest __tests__/snapshot.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement snapshot.ts**

Create `app/src/sync/snapshot.ts`:
```ts
export const SCHEMA_VERSION = 1;

// Whitelisted tables. No foreign keys, so insert order doesn't matter.
export const TABLES = ["entity", "event", "link", "plan", "preference", "news_topic", "memory"] as const;
export type TableName = (typeof TABLES)[number];
export type Row = Record<string, string | number | null>;

export interface Snapshot {
  schemaVersion: number;
  tables: Record<TableName, Row[]>;
}

export interface SnapshotDb {
  all(table: TableName): Promise<Row[]>;
  replaceAll(tables: Record<TableName, Row[]>): Promise<void>; // one transaction in the concrete impl
}

export async function serialize(db: SnapshotDb): Promise<Snapshot> {
  const tables = {} as Record<TableName, Row[]>;
  for (const t of TABLES) tables[t] = await db.all(t);
  return { schemaVersion: SCHEMA_VERSION, tables };
}

export async function restore(db: SnapshotDb, snap: Snapshot): Promise<void> {
  await db.replaceAll(snap.tables);
}

// Column names come from a snapshot decrypted with the user's own key (AEAD
// rejects tampering), and tables are whitelisted — so dynamic SQL here is safe.
export function buildInsert(table: TableName, row: Row): { sql: string; params: (string | number | null)[] } {
  const cols = Object.keys(row);
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  return { sql, params: cols.map((c) => row[c]) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `app/`): `pnpm exec jest __tests__/snapshot.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/sync/snapshot.ts app/__tests__/snapshot.test.ts
git commit -m "feat(sync): snapshot serialize/restore over a db port

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Backup core (orchestration)

**Files:**
- Create: `app/src/sync/backup.ts`
- Test: `app/__tests__/backup.test.ts`

**Interfaces:**
- Consumes: `seal`/`open` (Task 1); `serialize`/`restore`/`SCHEMA_VERSION`/`Snapshot`/`SnapshotDb` (Task 2).
- Produces:
  - `interface BackupTable { read(): Promise<{ ciphertext: string; version: number; schema_version: number } | null>; insert(row: { ciphertext: string; schema_version: number }): Promise<{ version: number } | "conflict">; updateIfVersion(expected: number, row: { ciphertext: string; schema_version: number }): Promise<{ version: number } | "conflict"> }`
  - `interface MetaStore { get(): Promise<{ lastSyncedVersion: number | null; lastBackupAt: number | null }>; set(meta: { lastSyncedVersion: number | null; lastBackupAt: number | null }): Promise<void> }`
  - `type BackupResult = { ok: true; version: number } | { conflict: true } | { error: string }`
  - `type RestoreResult = { ok: true } | { empty: true } | { error: string }`
  - `interface BackupDeps { db: SnapshotDb; table: BackupTable; getUserKey: () => Promise<Uint8Array | null>; randomBytes: (n: number) => Uint8Array; meta: MetaStore; now?: () => number }`
  - `interface Backup { backupNow(opts?: { force?: boolean }): Promise<BackupResult>; restoreNow(): Promise<RestoreResult>; getStatus(): Promise<{ lastBackupAt: number | null }> }`
  - `createBackup(deps: BackupDeps): Backup`
  - `backup(): Backup` — lazily-built real instance (wired in Task 4).

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/backup.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `app/`): `pnpm exec jest __tests__/backup.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement backup.ts**

Create `app/src/sync/backup.ts`:
```ts
import { open, seal } from "./envelope";
import { restore, serialize, SCHEMA_VERSION, type Snapshot, type SnapshotDb } from "./snapshot";

export interface BackupTable {
  read(): Promise<{ ciphertext: string; version: number; schema_version: number } | null>;
  insert(row: { ciphertext: string; schema_version: number }): Promise<{ version: number } | "conflict">;
  updateIfVersion(
    expected: number,
    row: { ciphertext: string; schema_version: number }
  ): Promise<{ version: number } | "conflict">;
}

export interface MetaStore {
  get(): Promise<{ lastSyncedVersion: number | null; lastBackupAt: number | null }>;
  set(meta: { lastSyncedVersion: number | null; lastBackupAt: number | null }): Promise<void>;
}

export type BackupResult = { ok: true; version: number } | { conflict: true } | { error: string };
export type RestoreResult = { ok: true } | { empty: true } | { error: string };

export interface BackupDeps {
  db: SnapshotDb;
  table: BackupTable;
  getUserKey: () => Promise<Uint8Array | null>;
  randomBytes: (n: number) => Uint8Array;
  meta: MetaStore;
  now?: () => number;
}

export interface Backup {
  backupNow(opts?: { force?: boolean }): Promise<BackupResult>;
  restoreNow(): Promise<RestoreResult>;
  getStatus(): Promise<{ lastBackupAt: number | null }>;
}

export function createBackup(deps: BackupDeps): Backup {
  const now = deps.now ?? (() => Date.now());

  return {
    async backupNow(opts) {
      const key = await deps.getUserKey();
      if (!key) return { error: "Sign in to back up" };
      try {
        const blob = seal(key, await serialize(deps.db), deps.randomBytes(24));
        let expected: number | null;
        if (opts?.force) {
          const remote = await deps.table.read();
          expected = remote ? remote.version : null;
        } else {
          expected = (await deps.meta.get()).lastSyncedVersion;
        }
        const row = { ciphertext: blob, schema_version: SCHEMA_VERSION };
        const res = expected === null
          ? await deps.table.insert(row)
          : await deps.table.updateIfVersion(expected, row);
        if (res === "conflict") return { conflict: true };
        await deps.meta.set({ lastSyncedVersion: res.version, lastBackupAt: now() });
        return { ok: true, version: res.version };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Backup failed" };
      }
    },

    async restoreNow() {
      const key = await deps.getUserKey();
      if (!key) return { error: "Sign in to restore" };
      try {
        const remote = await deps.table.read();
        if (!remote) return { empty: true };
        if (remote.schema_version > SCHEMA_VERSION)
          return { error: "This backup is from a newer version of Bram" };
        await restore(deps.db, open(key, remote.ciphertext) as Snapshot);
        const prev = await deps.meta.get();
        await deps.meta.set({ lastSyncedVersion: remote.version, lastBackupAt: prev.lastBackupAt });
        return { ok: true };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Restore failed" };
      }
    },

    async getStatus() {
      return { lastBackupAt: (await deps.meta.get()).lastBackupAt };
    },
  };
}

let _default: Backup | null = null;
// Lazily-built real instance (adapters required at call time so unit tests of
// createBackup don't pull native/ESM modules into jest). Wired in Task 4.
export function backup(): Backup {
  if (_default) return _default;
  const { getSupabase } = require("../auth/supabase") as typeof import("../auth/supabase");
  const { createSupabaseBackupTable } = require("./backup-store") as typeof import("./backup-store");
  const { createSqliteSnapshotDb } = require("./sqlite-snapshot-db") as typeof import("./sqlite-snapshot-db");
  const { createSecureMetaStore } = require("./meta") as typeof import("./meta");
  const { account } = require("../auth/account") as typeof import("../auth/account");
  const { getRandomBytes } = require("expo-crypto") as typeof import("expo-crypto");
  const client = getSupabase();
  if (!client) throw new Error("Cloud sync is not configured");
  _default = createBackup({
    db: createSqliteSnapshotDb(),
    table: createSupabaseBackupTable(client),
    getUserKey: () => account().getUserKey(),
    randomBytes: getRandomBytes,
    meta: createSecureMetaStore(),
  });
  return _default;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `app/`): `pnpm exec jest __tests__/backup.test.ts`
Expected: PASS (7 tests). (The `require(...)` in `backup()` is never hit by these tests.)

- [ ] **Step 5: Commit**

```bash
git add app/src/sync/backup.ts app/__tests__/backup.test.ts
git commit -m "feat(sync): backup/restore orchestration core

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Device adapters + Supabase migration

**Files:**
- Create: `app/src/sync/backup-store.ts` (`createSupabaseBackupTable`)
- Create: `app/src/sync/sqlite-snapshot-db.ts` (`createSqliteSnapshotDb`)
- Create: `app/src/sync/meta.ts` (`createSecureMetaStore`)
- Create: `supabase/backup-table.sql` (migration to run once)

**Interfaces:**
- Consumes: `BackupTable`/`MetaStore` (Task 3); `SnapshotDb`/`buildInsert`/`TABLES`/`Row` (Task 2); `openBramDatabase` (`app/src/db/open.ts`), `SqliteDatabase` (`app/src/db/sqlite.ts`), `getSupabase` (`app/src/auth/supabase.ts`).
- Produces: `createSupabaseBackupTable(client): BackupTable`, `createSqliteSnapshotDb(): SnapshotDb`, `createSecureMetaStore(): MetaStore`.

(No unit tests: these are thin wiring around native/remote services jest can't run. The decision logic they feed is already covered by Task 3; correctness is verified on a device build and via Task 5's live check.)

- [ ] **Step 1: Create the Supabase migration**

Create `supabase/backup-table.sql`:
```sql
-- Run once in the Supabase SQL editor (project: bram). Stores one encrypted
-- snapshot per user. Server sees only ciphertext.
create table if not exists public.backup (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ciphertext     text    not null,
  version        integer not null default 1,
  schema_version integer not null,
  updated_at     timestamptz not null default now()
);
alter table public.backup enable row level security;
create policy "own backup" on public.backup
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Implement the SQLite snapshot adapter**

Create `app/src/sync/sqlite-snapshot-db.ts`:
```ts
import { openBramDatabase } from "../db/open";
import type { SqliteDatabase } from "../db/sqlite";
import { buildInsert, TABLES, type Row, type SnapshotDb } from "./snapshot";

// Opens its own handle to bram.db lazily (mirrors how the app opens it).
// ponytail: a second connection to the same file; fine for manual, user-driven
// backup/restore. Thread the shared Services handle if it ever races live writes.
export function createSqliteSnapshotDb(): SnapshotDb {
  let dbP: Promise<SqliteDatabase> | null = null;
  const getDb = () => (dbP ??= openBramDatabase());
  return {
    async all(table) {
      const db = await getDb();
      return db.getAllAsync<Row>(`SELECT * FROM ${table}`);
    },
    async replaceAll(tables) {
      const db = await getDb();
      await db.execAsync("BEGIN");
      try {
        for (const t of TABLES) {
          await db.runAsync(`DELETE FROM ${t}`, []);
          for (const row of tables[t] ?? []) {
            const { sql, params } = buildInsert(t, row);
            await db.runAsync(sql, params);
          }
        }
        await db.execAsync("COMMIT");
      } catch (e) {
        await db.execAsync("ROLLBACK");
        throw e;
      }
    },
  };
}
```

- [ ] **Step 3: Implement the SecureStore meta store**

Create `app/src/sync/meta.ts`:
```ts
import * as SecureStore from "expo-secure-store";
import type { MetaStore } from "./backup";

const SLOT = "bram_sync_meta"; // kept out of the synced tables so Restore can't clobber it
const EMPTY = { lastSyncedVersion: null as number | null, lastBackupAt: null as number | null };

export function createSecureMetaStore(): MetaStore {
  return {
    async get() {
      const raw = await SecureStore.getItemAsync(SLOT);
      if (!raw) return { ...EMPTY };
      try {
        return JSON.parse(raw);
      } catch {
        return { ...EMPTY };
      }
    },
    async set(meta) {
      await SecureStore.setItemAsync(SLOT, JSON.stringify(meta));
    },
  };
}
```

- [ ] **Step 4: Implement the Supabase backup table adapter**

Create `app/src/sync/backup-store.ts`:
```ts
import type { BackupTable } from "./backup";

// The Supabase fluent builder is hard to type precisely; keep `any` at this
// boundary only. The BackupTable port above it is fully typed.
// ponytail: `any` at the Supabase boundary; everything consuming it is typed.
interface SupabaseClientLike {
  from(table: string): any;
}

export function createSupabaseBackupTable(client: SupabaseClientLike): BackupTable {
  const tbl = () => client.from("backup");
  return {
    async read() {
      const { data, error } = await tbl().select("ciphertext, version, schema_version").maybeSingle();
      if (error) throw new Error(error.message);
      return data
        ? { ciphertext: data.ciphertext, version: data.version, schema_version: data.schema_version }
        : null;
    },
    async insert(row) {
      const { data, error } = await tbl()
        .insert({ ciphertext: row.ciphertext, schema_version: row.schema_version })
        .select("version")
        .single();
      if (error) return error.code === "23505" ? "conflict" : Promise.reject(new Error(error.message));
      return { version: data.version };
    },
    async updateIfVersion(expected, row) {
      const { data, error } = await tbl()
        .update({
          ciphertext: row.ciphertext,
          schema_version: row.schema_version,
          version: expected + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("version", expected)
        .select("version");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return "conflict";
      return { version: data[0].version };
    },
  };
}
```

- [ ] **Step 5: Typecheck**

Run (from `app/`): `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/sync/backup-store.ts app/src/sync/sqlite-snapshot-db.ts app/src/sync/meta.ts supabase/backup-table.sql
git commit -m "feat(sync): device adapters (sqlite/supabase/securestore) + migration

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the migration (manual, one-time)**

In the Supabase dashboard → SQL editor, paste and run `supabase/backup-table.sql`. Confirm the `backup` table and its "own backup" policy appear under Authentication → Policies.

---

### Task 5: Settings UI integration

**Files:**
- Modify: `app/src/screens/SettingsScreen.tsx`
- Test: `app/__tests__/SettingsBackup.test.tsx`
- Modify: `app/__tests__/SettingsAccount.test.tsx` (pass a `backup` prop so the signed-in render doesn't hit the lazy default)

**Interfaces:**
- Consumes: `Backup` + `backup()` (Task 3).
- Produces: backup/restore controls in the signed-in branch of "Cloud backup & sync".

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/SettingsBackup.test.tsx`:
```tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { SettingsScreen } from "../src/screens/SettingsScreen";
import { ServicesProvider, type Services } from "../src/app/services";
import { createBramApi } from "../src/core/api";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";
import { createInMemoryLifeStore } from "../src/core/life-store-memory";
import type { Account } from "../src/auth/account";
import type { Backup } from "../src/sync/backup";

function services(): Services {
  return {
    api: createBramApi({ baseUrl: "http://x", fetchFn: (async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch }),
    plans: createMemoryPlanRepository(),
    topics: createMemoryTopicRepository([]),
    prefs: createMemoryPreferenceRepository(),
    store: createInMemoryLifeStore(),
    speaker: { speak: async () => {}, stop: () => {} },
    voice: { start: async () => {}, stop: () => {} },
    notifier: { schedule: async () => {}, scheduleAt: async () => {}, cancel: async () => {} },
    calendar: { listEvents: async () => [] },
    newId: () => "id-1",
    now: () => Date.now(),
  };
}

const signedIn: Account = {
  signUp: async () => ({ recoveryCode: "" }),
  signIn: async () => {},
  signOut: async () => {},
  getAccount: async () => ({ email: "a@b.com" }),
  getUserKey: async () => null,
};

function fakeBackup(over: Partial<Backup> = {}): Backup {
  return {
    backupNow: async () => ({ ok: true, version: 1 }),
    restoreNow: async () => ({ ok: true }),
    getStatus: async () => ({ lastBackupAt: null }),
    ...over,
  };
}

const renderWith = (backup: Backup) =>
  render(
    <ServicesProvider services={services()}>
      <SettingsScreen account={signedIn} backup={backup} />
    </ServicesProvider>
  );

describe("Settings backup controls", () => {
  it("shows Back up now when signed in", async () => {
    renderWith(fakeBackup());
    await waitFor(() => expect(screen.getByLabelText("Back up now")).toBeTruthy());
  });

  it("calls backupNow and shows success", async () => {
    const backupNow = jest.fn(async () => ({ ok: true as const, version: 2 }));
    renderWith(fakeBackup({ backupNow }));
    fireEvent.press(await screen.findByLabelText("Back up now"));
    await waitFor(() => expect(backupNow).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/backed up/i)).toBeTruthy());
  });

  it("offers Overwrite on conflict and forces past it", async () => {
    const backupNow = jest
      .fn()
      .mockResolvedValueOnce({ conflict: true })
      .mockResolvedValueOnce({ ok: true, version: 5 });
    renderWith(fakeBackup({ backupNow }));
    fireEvent.press(await screen.findByLabelText("Back up now"));
    fireEvent.press(await screen.findByLabelText("Overwrite"));
    await waitFor(() => expect(backupNow).toHaveBeenLastCalledWith({ force: true }));
  });

  it("restore confirms then calls restoreNow", async () => {
    const restoreNow = jest.fn(async () => ({ ok: true as const }));
    renderWith(fakeBackup({ restoreNow }));
    fireEvent.press(await screen.findByLabelText("Restore"));
    fireEvent.press(await screen.findByLabelText("Confirm restore"));
    await waitFor(() => expect(restoreNow).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `app/`): `pnpm exec jest __tests__/SettingsBackup.test.tsx`
Expected: FAIL — `SettingsScreen` doesn't accept `backup` / no "Back up now" label.

- [ ] **Step 3: Wire backup into SettingsScreen**

In `app/src/screens/SettingsScreen.tsx`:

Add imports near the auth imports:
```tsx
import { backup as defaultBackup, type Backup } from "../sync/backup";
```

Add a safe default beside `safeDefaultAccount` (so an unconfigured project still renders):
```tsx
// backup() throws when Supabase isn't configured; Settings must still render.
function safeDefaultBackup(): Backup {
  try {
    return defaultBackup();
  } catch {
    return {
      backupNow: async () => ({ error: "Cloud sync is not configured" }),
      restoreNow: async () => ({ error: "Cloud sync is not configured" }),
      getStatus: async () => ({ lastBackupAt: null }),
    };
  }
}
```

Extend the component signature to accept `backup`:
```tsx
export function SettingsScreen({
  account = safeDefaultAccount(),
  backup = safeDefaultBackup(),
}: { account?: Account; backup?: Backup } = {}) {
```

Add backup UI state beside the existing account state:
```tsx
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    if (acct) backup.getStatus().then((s) => setLastBackupAt(s.lastBackupAt)).catch(() => {});
  }, [acct]);

  const runBackup = async (opts?: { force?: boolean }) => {
    setBackupBusy(true);
    setBackupMsg("");
    setConflict(false);
    const res = await backup.backupNow(opts);
    setBackupBusy(false);
    if ("ok" in res) {
      setBackupMsg("Backed up ✓");
      setLastBackupAt((await backup.getStatus()).lastBackupAt);
    } else if ("conflict" in res) {
      setConflict(true);
    } else {
      setBackupMsg(res.error);
    }
  };

  const runRestore = async () => {
    setConfirmRestore(false);
    setBackupBusy(true);
    setBackupMsg("");
    const res = await backup.restoreNow();
    setBackupBusy(false);
    if ("ok" in res) setBackupMsg("Restored ✓ — restart Bram to finish loading your data");
    else if ("empty" in res) setBackupMsg("Nothing to restore yet");
    else setBackupMsg(res.error);
  };
```

Replace the signed-in branch of the "Cloud backup & sync" `Card` (currently just the email + Sign out row) so it also renders the controls:
```tsx
            {acct ? (
              <>
                <View style={styles.topicRow}>
                  <Text style={styles.factText}>{acct.email}</Text>
                  <PressableScale
                    onPress={async () => { await account.signOut(); refreshAccount(); }}
                    accessibilityLabel="Sign out"
                    hitSlop={12}
                    style={styles.forget}
                  >
                    <Ionicons name="log-out-outline" size={18} color={colors.muted} />
                  </PressableScale>
                </View>
                <Text style={styles.empty}>
                  {lastBackupAt ? `Last backed up: ${new Date(lastBackupAt).toLocaleString()}` : "Not backed up yet"}
                </Text>
                {backupBusy ? <ActivityIndicator accessibilityLabel="working" color={colors.accent} style={{ marginVertical: space.md }} /> : null}
                {backupMsg ? <Text style={styles.empty}>{backupMsg}</Text> : null}
                {conflict ? (
                  <>
                    <Text style={styles.empty}>A newer backup exists on another device.</Text>
                    <View style={{ height: space.sm }} />
                    <GradientButton label="Restore first" onPress={() => setConfirmRestore(true)} accessibilityLabel="Restore first" />
                    <View style={{ height: space.sm }} />
                    <GradientButton variant="danger" label="Overwrite" onPress={() => runBackup({ force: true })} accessibilityLabel="Overwrite" />
                  </>
                ) : confirmRestore ? (
                  <>
                    <Text style={styles.empty}>This replaces this device's data with your last backup.</Text>
                    <View style={{ height: space.sm }} />
                    <GradientButton label="Confirm restore" onPress={runRestore} accessibilityLabel="Confirm restore" />
                    <View style={{ height: space.sm }} />
                    <GradientButton variant="ghost" label="Cancel" onPress={() => setConfirmRestore(false)} accessibilityLabel="Cancel restore" />
                  </>
                ) : (
                  <>
                    <View style={{ height: space.sm }} />
                    <GradientButton label="Back up now" onPress={() => runBackup()} disabled={backupBusy} accessibilityLabel="Back up now" />
                    <View style={{ height: space.sm }} />
                    <GradientButton variant="ghost" label="Restore" onPress={() => setConfirmRestore(true)} accessibilityLabel="Restore" />
                  </>
                )}
              </>
            ) : (
```
(The `: (` continues into the existing signed-out `<>…</>` block — leave that unchanged.)

Ensure `ActivityIndicator` is imported from `react-native` at the top of the file (add it to the existing import).

- [ ] **Step 4: Update the existing account test so its signed-in render injects a backup**

In `app/__tests__/SettingsAccount.test.tsx`, change `renderWith` to pass a stub `backup` (prevents the signed-in case from constructing the lazy default):
```tsx
import type { Backup } from "../src/sync/backup";

const stubBackup: Backup = {
  backupNow: async () => ({ ok: true, version: 1 }),
  restoreNow: async () => ({ ok: true }),
  getStatus: async () => ({ lastBackupAt: null }),
};

const renderWith = (account: Account) =>
  render(
    <ServicesProvider services={services()}>
      <SettingsScreen account={account} backup={stubBackup} />
    </ServicesProvider>
  );
```

- [ ] **Step 5: Run the new + changed tests**

Run (from `app/`): `pnpm exec jest __tests__/SettingsBackup.test.tsx __tests__/SettingsAccount.test.tsx`
Expected: PASS (4 + 3 tests).

- [ ] **Step 6: Full typecheck + suite**

Run (from `app/`): `pnpm exec tsc --noEmit && pnpm test`
Expected: typecheck clean; all suites pass (prior 143 + envelope 3, snapshot 4, backup 7, SettingsBackup 4 = 161).

- [ ] **Step 7: Commit**

```bash
git add app/src/screens/SettingsScreen.tsx app/__tests__/SettingsBackup.test.tsx app/__tests__/SettingsAccount.test.tsx
git commit -m "feat(sync): backup & restore controls in Settings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Deferred / manual verification (not in this plan)

- **On-device:** the second SQLite handle + post-restore "restart to finish" UX; SecureStore meta persistence; a real backup→reinstall→restore round-trip against the live `backup` table.
- **Live integration check** (optional, like the auth one): a Node script that signs in a confirmed test user, pushes a sealed snapshot to the real `backup` table, pulls it back, and unwraps — confirming RLS + optimistic concurrency end to end.
- Deferred features remain: live multi-device merge, automatic/background backup, new-device auto-restore, backup history, snapshot compression.

## Self-review

- **Spec coverage:** behavior/back-up/restore/guard (Tasks 3, 5) ✓; Supabase table + RLS (Task 4) ✓; snapshot format + TABLES + SCHEMA_VERSION (Task 2) ✓; modules envelope/snapshot/backup-store/backup (Tasks 1–4) ✓; SecureStore meta out of synced tables (Task 4 `meta.ts`) ✓; UI controls + conflict prompt + last-backed-up + spinner (Task 5) ✓; edge cases — first backup, empty restore, newer schema, decrypt failure, transactional restore (Tasks 3, 4) ✓; testing per module ✓.
- **Placeholder scan:** none; every code step is complete.
- **Type consistency:** `SnapshotDb`/`Snapshot`/`Row`/`TableName`/`TABLES`/`SCHEMA_VERSION` (snapshot.ts) and `BackupTable`/`MetaStore`/`BackupResult`/`RestoreResult`/`Backup`/`createBackup`/`backup` (backup.ts) are used identically across Tasks 2–5. `seal(userKey, value, nonce)` / `open(userKey, blob)` match between Tasks 1, 3. Adapter factories `createSupabaseBackupTable`/`createSqliteSnapshotDb`/`createSecureMetaStore` match the `require(...)` names in `backup()`. Settings injects `Backup` via prop, matching the test fakes.
- **Note:** `"Last backed up"` uses `new Date(ts).toLocaleString()`, not `formatRelative` (which is future-oriented), to avoid wrong "in -3 days" output.
