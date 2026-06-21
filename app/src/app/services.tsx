import React, { createContext, useContext } from "react";
import type { BramApi } from "../core/api";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
  MemoryRepository,
} from "../core/repository";
import type { Speaker } from "../speech/tts";
import type { VoiceCapture } from "../speech/stt";
import type { Notifier } from "../notify/notifier";

export interface Services {
  api: BramApi;
  plans: PlanRepository;
  topics: TopicRepository;
  prefs: PreferenceRepository;
  memories: MemoryRepository;
  speaker: Speaker;
  voice: VoiceCapture;
  notifier: Notifier;
  newId: () => string;
  now: () => number;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: React.ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error("ServicesProvider missing");
  return s;
}
