import type { LifeStore } from "../core/life-store";
import type { SqliteDatabase } from "./sqlite";
import { rowToEntity, rowToEvent, type EntityRow, type EventRow } from "./mappers";

export function createSqliteLifeStore(db: SqliteDatabase): LifeStore {
  return {
    async upsertEntity(type, name, attributes, now, newId) {
      const key = name.trim().toLowerCase();
      const rows = await db.getAllAsync<EntityRow>(
        "SELECT * FROM entity WHERE type = ? AND lower(name) = ?",
        [type, key]
      );
      const existing = rows[0];
      if (existing) {
        const prev = existing.attributes ? JSON.parse(existing.attributes) : null;
        const merged = attributes ? { ...(prev ?? {}), ...attributes } : prev;
        const mergedJson = merged ? JSON.stringify(merged) : null;
        await db.runAsync("UPDATE entity SET last_mentioned_at = ?, attributes = ? WHERE id = ?", [now, mergedJson, existing.id]);
        return rowToEntity({ ...existing, last_mentioned_at: now, attributes: mergedJson });
      }
      const id = newId();
      const attrJson = attributes ? JSON.stringify(attributes) : null;
      await db.runAsync(
        "INSERT INTO entity (id, type, name, attributes, last_mentioned_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [id, type, name.trim(), attrJson, now, now]
      );
      return { id, type, name: name.trim(), attributes: attributes ?? null, lastMentionedAt: now, createdAt: now };
    },
    async addEvent(text, occurredAt, now, newId) {
      const id = newId();
      await db.runAsync("INSERT INTO event (id, text, occurred_at, created_at) VALUES (?, ?, ?, ?)", [id, text.trim(), occurredAt, now]);
      return { id, text: text.trim(), occurredAt, createdAt: now };
    },
    async link(fromId, toId) {
      await db.runAsync("INSERT OR IGNORE INTO link (from_id, to_id) VALUES (?, ?)", [fromId, toId]);
    },
    async people() {
      return (await db.getAllAsync<EntityRow>("SELECT * FROM entity WHERE type = 'person' ORDER BY last_mentioned_at DESC")).map(rowToEntity);
    },
    async goals() {
      return (await db.getAllAsync<EntityRow>("SELECT * FROM entity WHERE type = 'goal' ORDER BY last_mentioned_at DESC")).map(rowToEntity);
    },
    async facts() {
      return (await db.getAllAsync<EntityRow>("SELECT * FROM entity WHERE type = 'fact' ORDER BY created_at ASC")).map(rowToEntity);
    },
    async recentEvents(limit) {
      return (await db.getAllAsync<EventRow>("SELECT * FROM event ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT ?", [limit])).map(rowToEvent);
    },
    async search(tokens) {
      if (!tokens.length) return [];
      const args = tokens.map((t) => `%${t.toLowerCase()}%`);
      const nameWhere = tokens.map(() => "lower(name) LIKE ?").join(" OR ");
      const textWhere = tokens.map(() => "lower(text) LIKE ?").join(" OR ");
      const ents = (await db.getAllAsync<EntityRow>(`SELECT * FROM entity WHERE ${nameWhere}`, args)).map(rowToEntity);
      const evs = (await db.getAllAsync<EventRow>(`SELECT * FROM event WHERE ${textWhere}`, args)).map(rowToEvent);
      return [...ents, ...evs];
    },
    async eventsForEntity(entityId) {
      return (await db.getAllAsync<EventRow>(
        "SELECT e.* FROM event e JOIN link l ON l.from_id = e.id WHERE l.to_id = ? ORDER BY COALESCE(e.occurred_at, e.created_at) DESC",
        [entityId]
      )).map(rowToEvent);
    },
    async deleteEntity(id) {
      await db.runAsync("DELETE FROM entity WHERE id = ?", [id]);
      await db.runAsync("DELETE FROM link WHERE from_id = ? OR to_id = ?", [id, id]);
    },
  };
}
