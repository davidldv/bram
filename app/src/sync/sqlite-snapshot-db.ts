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
