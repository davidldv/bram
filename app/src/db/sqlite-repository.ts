import type { Plan, NewsTopic, Memory } from "../core/types";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
  MemoryRepository,
} from "../core/repository";
import type { SqliteDatabase } from "./sqlite";
import { rowToPlan, rowToTopic, rowToMemory, type PlanRow, type TopicRow, type MemoryRow } from "./mappers";

export function createSqlitePlanRepository(db: SqliteDatabase): PlanRepository {
  return {
    async add(plan: Plan) {
      await db.runAsync(
        "INSERT INTO plan (id, type, title, scheduled_at, created_at, done) VALUES (?, ?, ?, ?, ?, ?)",
        [plan.id, plan.type, plan.title, plan.scheduledAt, plan.createdAt, plan.done ? 1 : 0]
      );
    },
    async list() {
      const rows = await db.getAllAsync<PlanRow>("SELECT * FROM plan ORDER BY created_at ASC");
      return rows.map(rowToPlan);
    },
    async listForRange(startMs: number, endMs: number) {
      const rows = await db.getAllAsync<PlanRow>(
        "SELECT * FROM plan WHERE scheduled_at IS NOT NULL AND scheduled_at >= ? AND scheduled_at < ? ORDER BY scheduled_at ASC",
        [startMs, endMs]
      );
      return rows.map(rowToPlan);
    },
    async markDone(id: string) {
      await db.runAsync("UPDATE plan SET done = 1 WHERE id = ?", [id]);
    },
  };
}

export function createSqlitePreferenceRepository(db: SqliteDatabase): PreferenceRepository {
  return {
    async get(key: string) {
      const rows = await db.getAllAsync<{ value: string }>(
        "SELECT value FROM preference WHERE key = ?",
        [key]
      );
      return rows[0]?.value ?? null;
    },
    async set(key: string, value: string) {
      await db.runAsync(
        "INSERT INTO preference (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, value]
      );
    },
  };
}

export function createSqliteTopicRepository(db: SqliteDatabase): TopicRepository {
  return {
    async list() {
      const rows = await db.getAllAsync<TopicRow>("SELECT * FROM news_topic ORDER BY id ASC");
      return rows.map(rowToTopic);
    },
    async setEnabled(id: string, enabled: boolean) {
      await db.runAsync("UPDATE news_topic SET enabled = ? WHERE id = ?", [enabled ? 1 : 0, id]);
    },
  };
}

export function createSqliteMemoryRepository(db: SqliteDatabase): MemoryRepository {
  return {
    async add(memory: Memory) {
      await db.runAsync(
        "INSERT INTO memory (id, text, created_at) VALUES (?, ?, ?)",
        [memory.id, memory.text, memory.createdAt]
      );
    },
    async list() {
      const rows = await db.getAllAsync<MemoryRow>("SELECT * FROM memory ORDER BY created_at ASC");
      return rows.map(rowToMemory);
    },
    async delete(id: string) {
      await db.runAsync("DELETE FROM memory WHERE id = ?", [id]);
    },
  };
}
