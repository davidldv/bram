import type { Plan, NewsTopic, Memory, Entity, LifeEvent } from "../core/types";

export interface PlanRow {
  id: string;
  type: string;
  title: string;
  scheduled_at: number | null;
  created_at: number;
  done: number;
}

export function rowToPlan(r: PlanRow): Plan {
  return {
    id: r.id,
    type: r.type as Plan["type"],
    title: r.title,
    scheduledAt: r.scheduled_at,
    createdAt: r.created_at,
    done: r.done === 1,
  };
}

export interface TopicRow {
  id: string;
  label: string;
  enabled: number;
}

export function rowToTopic(r: TopicRow): NewsTopic {
  return { id: r.id, label: r.label, enabled: r.enabled === 1 };
}

export interface MemoryRow {
  id: string;
  text: string;
  created_at: number;
}

export function rowToMemory(r: MemoryRow): Memory {
  return { id: r.id, text: r.text, createdAt: r.created_at };
}

export interface EntityRow {
  id: string;
  type: string;
  name: string;
  attributes: string | null;
  last_mentioned_at: number;
  created_at: number;
}

export function rowToEntity(r: EntityRow): Entity {
  let attributes: Record<string, unknown> | null = null;
  if (r.attributes) {
    try { attributes = JSON.parse(r.attributes); } catch { attributes = null; }
  }
  return {
    id: r.id,
    type: r.type as Entity["type"],
    name: r.name,
    attributes,
    lastMentionedAt: r.last_mentioned_at,
    createdAt: r.created_at,
  };
}

export interface EventRow {
  id: string;
  text: string;
  occurred_at: number | null;
  created_at: number;
}

export function rowToEvent(r: EventRow): LifeEvent {
  return { id: r.id, text: r.text, occurredAt: r.occurred_at, createdAt: r.created_at };
}
