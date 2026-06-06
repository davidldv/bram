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
import { getBackendBaseUrl } from "./config";
import type { Services } from "./services";

export async function buildServices(): Promise<Services> {
  const db = await openBramDatabase();
  return {
    api: createBramApi({ baseUrl: getBackendBaseUrl() }),
    plans: createSqlitePlanRepository(db),
    topics: createSqliteTopicRepository(db),
    prefs: createSqlitePreferenceRepository(db),
    speaker: createSpeaker(),
    voice: createVoiceCapture(),
    newId: () => Crypto.randomUUID(),
    now: () => Date.now(),
  };
}
