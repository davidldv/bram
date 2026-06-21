import type { Plan, NewsTopic, Memory } from "./types";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
  MemoryRepository,
} from "./repository";

export function createMemoryPlanRepository(seed: Plan[] = []): PlanRepository {
  const plans: Plan[] = [...seed];
  return {
    async add(plan) {
      plans.push(plan);
    },
    async list() {
      return [...plans];
    },
    async listForRange(startMs, endMs) {
      return plans.filter(
        (p) => p.scheduledAt !== null && p.scheduledAt >= startMs && p.scheduledAt < endMs
      );
    },
    async markDone(id) {
      const p = plans.find((x) => x.id === id);
      if (p) p.done = true;
    },
  };
}

export function createMemoryPreferenceRepository(
  seed: Record<string, string> = {}
): PreferenceRepository {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    async get(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async set(key, value) {
      store.set(key, value);
    },
  };
}

export function createMemoryTopicRepository(seed: NewsTopic[]): TopicRepository {
  const topics: NewsTopic[] = [...seed];
  return {
    async list() {
      return [...topics];
    },
    async setEnabled(id, enabled) {
      const t = topics.find((x) => x.id === id);
      if (t) t.enabled = enabled;
    },
  };
}

// In-memory MemoryRepository (the "Memory" entity, in-memory backing).
export function createInMemoryMemoryRepository(seed: Memory[] = []): MemoryRepository {
  const facts: Memory[] = [...seed];
  return {
    async add(memory) {
      facts.push(memory);
    },
    async list() {
      return [...facts];
    },
    async delete(id) {
      const i = facts.findIndex((f) => f.id === id);
      if (i >= 0) facts.splice(i, 1);
    },
  };
}
