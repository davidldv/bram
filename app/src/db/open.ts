import * as SQLite from "expo-sqlite";
import type { SqliteDatabase } from "./sqlite";
import { SCHEMA_SQL, DEFAULT_TOPICS } from "./schema";

export async function openBramDatabase(name = "bram.db"): Promise<SqliteDatabase> {
  const db = (await SQLite.openDatabaseAsync(name)) as unknown as SqliteDatabase;
  await db.execAsync(SCHEMA_SQL);
  await seedDefaultTopics(db);
  return db;
}

async function seedDefaultTopics(db: SqliteDatabase): Promise<void> {
  const existing = await db.getAllAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM news_topic"
  );
  if ((existing[0]?.count ?? 0) > 0) return;
  for (const t of DEFAULT_TOPICS) {
    await db.runAsync(
      "INSERT INTO news_topic (id, label, enabled) VALUES (?, ?, ?)",
      [t.id, t.label, t.enabled]
    );
  }
}
