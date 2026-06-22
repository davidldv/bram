import type { Entity, LifeEvent } from "./types";
import type { LifeStore } from "./life-store";

export function createInMemoryLifeStore(
  seedEntities: Entity[] = [],
  seedEvents: LifeEvent[] = []
): LifeStore {
  const entities: Entity[] = [...seedEntities];
  const events: LifeEvent[] = [...seedEvents];
  const links: Array<[string, string]> = [];

  return {
    async upsertEntity(type, name, attributes, now, newId) {
      const key = name.trim().toLowerCase();
      const existing = entities.find((e) => e.type === type && e.name.toLowerCase() === key);
      if (existing) {
        existing.lastMentionedAt = now;
        if (attributes) existing.attributes = { ...(existing.attributes ?? {}), ...attributes };
        return existing;
      }
      const e: Entity = {
        id: newId(), type, name: name.trim(),
        attributes: attributes ?? null, lastMentionedAt: now, createdAt: now,
      };
      entities.push(e);
      return e;
    },
    async addEvent(text, occurredAt, now, newId) {
      const e: LifeEvent = { id: newId(), text: text.trim(), occurredAt, createdAt: now };
      events.push(e);
      return e;
    },
    async link(fromId, toId) {
      if (!links.some(([f, t]) => f === fromId && t === toId)) links.push([fromId, toId]);
    },
    async people() { return entities.filter((e) => e.type === "person"); },
    async goals() { return entities.filter((e) => e.type === "goal"); },
    async facts() { return entities.filter((e) => e.type === "fact"); },
    async recentEvents(limit) {
      return [...events]
        .sort((a, b) => (b.occurredAt ?? b.createdAt) - (a.occurredAt ?? a.createdAt))
        .slice(0, limit);
    },
    async search(tokens) {
      if (!tokens.length) return [];
      const hit = (s: string) => tokens.some((t) => s.toLowerCase().includes(t));
      return [...entities.filter((e) => hit(e.name)), ...events.filter((e) => hit(e.text))];
    },
    async eventsForEntity(entityId) {
      const ids = new Set(links.filter(([, to]) => to === entityId).map(([from]) => from));
      return events.filter((e) => ids.has(e.id));
    },
    async deleteEntity(id) {
      const i = entities.findIndex((e) => e.id === id);
      if (i >= 0) entities.splice(i, 1);
      // Remove all links where this entity is the source or target
      for (let j = links.length - 1; j >= 0; j--) {
        const [from, to] = links[j];
        if (from === id || to === id) {
          links.splice(j, 1);
        }
      }
    },
  };
}
