import * as Crypto from "expo-crypto";
import { createBramApi } from "../core/api";
import {
  createSqlitePlanRepository,
  createSqlitePreferenceRepository,
  createSqliteTopicRepository,
  createSqliteMemoryRepository,
} from "../db/sqlite-repository";
import { createSqliteLifeStore } from "../db/sqlite-life-store";
import { migrateMemories } from "../core/migrate";
import { openBramDatabase } from "../db/open";
import { createSpeaker } from "../speech/tts";
import { createVoiceCapture } from "../speech/stt";
import { createNotifier } from "../notify/notifier";
import { createCalendar } from "../calendar/calendar";
import { getPersonaName } from "../core/persona";
import { getBackendBaseUrl } from "./config";
import type { Services } from "./services";

export async function buildServices(): Promise<Services> {
  const db = await openBramDatabase();
  const prefs = createSqlitePreferenceRepository(db);
  const store = createSqliteLifeStore(db);
  const newId = () => Crypto.randomUUID();

  // One-time copy of legacy flat memories into the life-model.
  await migrateMemories({ store, memories: createSqliteMemoryRepository(db), prefs, newId });

  return {
    api: createBramApi({ baseUrl: getBackendBaseUrl() }),
    plans: createSqlitePlanRepository(db),
    topics: createSqliteTopicRepository(db),
    prefs,
    store,
    speaker: createSpeaker(),
    voice: createVoiceCapture(),
    notifier: createNotifier(() => getPersonaName(prefs)),
    calendar: createCalendar(),
    newId,
    now: () => Date.now(),
  };
}
