import type { Plan, NewsTopic } from "../core/types";

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
