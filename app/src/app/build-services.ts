import * as Crypto from "expo-crypto";
import { createBramApi } from "../core/api";
import {
  createSqlitePlanRepository,
  createSqlitePreferenceRepository,
  createSqliteTopicRepository,
} from "../db/sqlite-repository";
import { openBramDatabase } from "../db/open";
import { createSpeaker } from "../speech/tts";
import { createVoiceCapture } from "../speech/stt";
import { createNotifier } from "../notify/notifier";
import { getPersonaName } from "../core/persona";
import { getBackendBaseUrl } from "./config";
import type { Services } from "./services";

export async function buildServices(): Promise<Services> {
  const db = await openBramDatabase();
  const prefs = createSqlitePreferenceRepository(db);
  return {
    api: createBramApi({ baseUrl: getBackendBaseUrl() }),
    plans: createSqlitePlanRepository(db),
    topics: createSqliteTopicRepository(db),
    prefs,
    speaker: createSpeaker(),
    voice: createVoiceCapture(),
    notifier: createNotifier(() => getPersonaName(prefs)),
    newId: () => Crypto.randomUUID(),
    now: () => Date.now(),
  };
}
