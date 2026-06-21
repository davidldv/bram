import type { Plan, NewsTopic, Memory } from "./types";

export interface PlanRepository {
  add(plan: Plan): Promise<void>;
  list(): Promise<Plan[]>;
  listForRange(startMs: number, endMs: number): Promise<Plan[]>;
  markDone(id: string): Promise<void>;
}

export interface PreferenceRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface TopicRepository {
  list(): Promise<NewsTopic[]>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
}

export interface MemoryRepository {
  add(memory: Memory): Promise<void>;
  list(): Promise<Memory[]>;
  delete(id: string): Promise<void>;
}
