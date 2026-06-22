import type { Entity, EntityType, LifeEvent } from "./types";

export interface LifeStore {
  upsertEntity(
    type: EntityType,
    name: string,
    attributes: Record<string, unknown> | null,
    now: number,
    newId: () => string
  ): Promise<Entity>;
  addEvent(text: string, occurredAt: number | null, now: number, newId: () => string): Promise<LifeEvent>;
  link(fromId: string, toId: string): Promise<void>;
  people(): Promise<Entity[]>;
  goals(): Promise<Entity[]>;
  facts(): Promise<Entity[]>;
  recentEvents(limit: number): Promise<LifeEvent[]>;
  search(tokens: string[]): Promise<(Entity | LifeEvent)[]>;
  eventsForEntity(entityId: string): Promise<LifeEvent[]>;
  deleteEntity(id: string): Promise<void>;
  allEntities(): Promise<Entity[]>;
  graphEdges(): Promise<Array<[string, string]>>;
  entityNeighbors(id: string): Promise<Entity[]>;
  updateEntity(id: string, name: string, attributes: Record<string, unknown> | null): Promise<Entity>;
}
