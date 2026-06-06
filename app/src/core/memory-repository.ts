import type { Plan, NewsTopic } from "./types";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
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
