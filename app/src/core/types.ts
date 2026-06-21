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
