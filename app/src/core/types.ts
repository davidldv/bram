export type PlanType = "reminder" | "event" | "task";

export interface Plan {
  id: string;
  type: PlanType;
  title: string;
  scheduledAt: number | null;
  createdAt: number;
  done: boolean;
}

export interface Headline {
  title: string;
  source: string;
  url: string;
}

export interface NewsTopic {
  id: string;
  label: string;
  enabled: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Memory {
  id: string;
  text: string;
  createdAt: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startMs: number;
  endMs: number | null;
  allDay: boolean;
}

export type EntityType = "person" | "goal" | "fact";

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  attributes: Record<string, unknown> | null;
  lastMentionedAt: number;
  createdAt: number;
}

export interface LifeEvent {
  id: string;
  text: string;
  occurredAt: number | null;
  createdAt: number;
}

// Parsed-but-not-yet-stored extraction items.
export type ExtractedItem =
  | { kind: "entity"; type: EntityType; text: string; attributes?: Record<string, unknown> }
  | { kind: "event"; text: string; date: string | null };
