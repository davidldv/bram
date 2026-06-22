import type { LifeStore } from "./life-store";
import type { MemoryRepository, PreferenceRepository } from "./repository";

const FLAG = "life_model_migrated";

// One-time copy of legacy flat `memory` rows into entity(type='fact'). Idempotent
// via a preference flag. The memory table is left in place but no longer written.
export async function migrateMemories(deps: {
  store: LifeStore;
  memories: MemoryRepository;
  prefs: PreferenceRepository;
  newId: () => string;
}): Promise<void> {
  if ((await deps.prefs.get(FLAG)) === "1") return;
  for (const m of await deps.memories.list()) {
    await deps.store.upsertEntity("fact", m.text, null, m.createdAt, deps.newId);
  }
  await deps.prefs.set(FLAG, "1");
}
