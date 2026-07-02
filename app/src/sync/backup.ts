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
