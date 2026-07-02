# Encrypted Backup & Sync Engine

**Date:** 2026-06-28
**Status:** Design approved, pending spec review

## Summary

Bram's local SQLite life-model can now be backed up to the cloud and restored on
another device, **end-to-end encrypted** with the account's `userKey` (see
`2026-06-27-account-signup-design.md`). The server (Supabase) stores only
ciphertext.

v1 is **snapshot backup & restore**, not live multi-device merge: the whole DB
is serialized, encrypted, and uploaded as a single versioned row; restore
replaces the local DB with the snapshot. Triggers are **manual** ("Back up
now" / "Restore"). A **guard-and-warn** check prevents a stale device from
silently clobbering a newer backup made elsewhere.

## Goals

- Don't lose data: a user can recover their full life-model after a reinstall or
  on a new phone.
- Zero-knowledge: Supabase only ever stores an encrypted blob it cannot read.
- Safe overwrite: warn before a stale device overwrites a newer backup.

## Non-goals (deferred)

- **Live multi-device merge** (concurrent edits reconciled per-record). Would
  need `updated_at` on every table, delete tombstones, a change log, and
  conflict resolution. Out of scope.
- **Automatic backup** (on background) and **auto-restore on new device**.
  Manual buttons only in v1.
- **Backup history / rollback.** A single current snapshot per user.

## Behavior

- **Back up now**: `serialize` local DB → `seal` with `userKey` →
  `push` to Supabase. Updates "Last backed up: …".
- **Restore**: `pull` → `open` → `restore` (replace local DB inside a
  transaction).
- **Guard + warn**: every backup carries an integer `version`. The device
  remembers the `version` it last synced (`lastSyncedVersion`). On Back up, if
  the remote `version` differs from `lastSyncedVersion`, the push is a
  **conflict**: the UI offers **Restore first** (safe) or **Overwrite** (force
  past the guard). Restore and a forced Overwrite both reset
  `lastSyncedVersion` to the resulting remote version.
- Requires a signed-in account with a cached `userKey`. Without an account, the
  Settings section shows the existing signup CTA instead.

## Data model: Supabase

One table with row-level security (the wrapped keys live in `user_metadata`, but
the backup blob needs a table). Run once in the SQL editor:

```sql
create table public.backup (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ciphertext     text    not null,            -- hex(nonce ‖ XChaCha20-Poly1305(userKey, snapshot-json))
  version        integer not null default 1,
  schema_version integer not null,            -- app DB schema rev, for forward-compat
  updated_at     timestamptz not null default now()
);
alter table public.backup enable row level security;
create policy "own backup" on public.backup
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`user_id` defaults to `auth.uid()`, so inserts don't pass it. One row per user.

`ponytail:` single row in a `text` column. Move to Supabase Storage only if a
snapshot ever exceeds a few hundred KB — a personal dataset won't for a long
time.

## Snapshot format

```ts
const SCHEMA_VERSION = 1;
const TABLES = ["entity", "event", "link", "plan", "preference", "news_topic", "memory"] as const;

interface Snapshot {
  schemaVersion: number;
  tables: Record<(typeof TABLES)[number], Record<string, unknown>[]>;
}
```

The tables have no foreign-key constraints, so insert order is irrelevant.
Restore deletes all rows in each table and bulk-inserts the snapshot's rows
inside a single transaction.

The decrypted snapshot is trusted input: it can only be produced by the user's
own `userKey`, and AEAD rejects any tampered blob, so dynamic column names built
from snapshot rows are safe. Tables are still whitelisted via `TABLES`.

## Modules & interfaces

- **`app/src/sync/snapshot.ts`** — pure orchestration over a tiny DB port:
  ```ts
  interface SnapshotDb {
    all(table: string): Promise<Record<string, unknown>[]>;
    replaceAll(rows: Record<(typeof TABLES)[number], Record<string, unknown>[]>): Promise<void>; // one transaction
  }
  serialize(db: SnapshotDb): Promise<Snapshot>;
  restore(db: SnapshotDb, snap: Snapshot): Promise<void>;
  ```
  Concrete `createSqliteSnapshotDb(db)` wraps `expo-sqlite`
  (`getAllAsync`, `withTransactionAsync`, `runAsync`).
- **`app/src/sync/envelope.ts`** — pure AEAD over a JSON snapshot:
  ```ts
  seal(userKey: Uint8Array, snap: Snapshot, nonce: Uint8Array): string; // hex(nonce ‖ ct)
  open(userKey: Uint8Array, blob: string): Snapshot;                    // throws on wrong key / tamper
  ```
  XChaCha20-Poly1305 via `@noble/ciphers`, hex via `@noble/hashes/utils.js`.
- **`app/src/sync/backup-store.ts`** — Supabase side over a fakeable client:
  ```ts
  interface BackupRow { ciphertext: string; version: number; schema_version: number }
  pull(client): Promise<{ blob: string; version: number; schemaVersion: number } | null>;
  push(client, blob: string, schemaVersion: number, expectedVersion: number | null):
    Promise<{ version: number } | "conflict">;
  ```
  `push` with `expectedVersion === null` inserts (`version` defaults to 1; a PK
  violation from a race is treated as `"conflict"`); otherwise an optimistic
  `update … where version = expectedVersion` returning the row — 0 rows returned
  means another device moved the version, i.e. `"conflict"`. Success sets
  `version = expectedVersion + 1`.
- **`app/src/sync/backup.ts`** — `createBackup(deps)` factory (mirrors
  `account.ts`), with a lazy default `backup()`:
  ```ts
  type BackupResult = { ok: true; version: number } | { conflict: true } | { error: string };
  interface Backup {
    backupNow(opts?: { force?: boolean }): Promise<BackupResult>;
    restoreNow(): Promise<{ ok: true } | { empty: true } | { error: string }>;
    getStatus(): Promise<{ lastBackupAt: number | null }>;
  }
  ```
  Deps: a `SnapshotDb`, the Supabase client, `account.getUserKey`,
  `randomBytes` (expo-crypto), and a `meta` store (SecureStore) holding
  `{ lastSyncedVersion, lastBackupAt }`. `backupNow`: serialize → seal →
  choose `expectedVersion`: when `force`, first `pull` the current remote
  `version` (null if no row) and use that; otherwise use `lastSyncedVersion`.
  Then `push(blob, SCHEMA_VERSION, expectedVersion)`; on `"conflict"` return
  `{ conflict: true }`; on success persist `lastSyncedVersion = version`,
  `lastBackupAt = now`. `restoreNow`: `pull` → (null → `{ empty: true }`) →
  reject if `schemaVersion > SCHEMA_VERSION` → `open` → `restore` → persist meta
  from the pulled version.

Sync metadata lives in **SecureStore** (`bram_sync_meta`), not a `preference`
row, so Restore (which replaces `preference`) doesn't clobber it.

## UI

Extend the signed-in branch of "Cloud backup & sync" in `SettingsScreen`:

- **Back up now** button → `backupNow()`. On `{ conflict }`, show an inline
  prompt: **Restore first** (→ `restoreNow`) or **Overwrite** (→
  `backupNow({ force: true })`).
- **Restore** button → confirm ("This replaces what's on this device with your
  last backup"), then `restoreNow()`.
- "Last backed up …" line from `getStatus()` (relative time via the existing
  `relative-time` helper).
- A spinner during the operation (reuse the `ActivityIndicator` pattern from
  `AuthFlow`).

## Error handling

- Not signed in / no `userKey` → `{ error: "Sign in to back up" }`; buttons only
  render when signed in.
- Network/Supabase error → surfaced via `{ error }`; local data untouched.
- `pull` returns null on Restore → `{ empty: true }` → "Nothing to restore yet".
- `schema_version` greater than `SCHEMA_VERSION` → refuse Restore ("This backup
  is from a newer version of Bram").
- Decrypt/tamper failure (`open` throws) → caught → `{ error }`; never touches
  the local DB.
- Restore replaces the DB inside a single transaction, so a mid-restore failure
  rolls back to the prior state.

## Testing

- **`envelope` (security-critical):** `seal`→`open` round-trips a snapshot;
  `open` with a wrong key throws; a tampered blob (flip a byte) throws.
- **`snapshot`:** `serialize`→`restore` round-trips all tables via an in-memory
  fake `SnapshotDb`; `replaceAll` clears pre-existing rows.
- **`backup-store`:** mock Supabase client — `pull` returns the row / null;
  `push` inserts when `expectedVersion` is null; returns `"conflict"` on version
  mismatch; bumps `version` on success.
- **`backup`:** `backupNow` happy path seals + pushes + persists meta;
  `backupNow` returns `{ conflict }` when the store reports a conflict;
  `backupNow({ force: true })` overwrites; `restoreNow` applies the snapshot and
  persists meta; `restoreNow` returns `{ empty }` with no remote backup.
- **`SettingsScreen`:** Back up / Restore render when signed in; a conflict shows
  the Restore/Overwrite prompt (RTL, injected fake `Backup`).

## Deferred follow-ups

- Live multi-device merge; automatic + new-device auto-restore; backup history.
- Compression of the snapshot before encryption (only if blobs grow).
