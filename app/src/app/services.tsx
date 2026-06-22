import React, { createContext, useContext } from "react";
import type { BramApi } from "../core/api";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
} from "../core/repository";
import type { LifeStore } from "../core/life-store";
import type { Speaker } from "../speech/tts";
import type { VoiceCapture } from "../speech/stt";
import type { Notifier } from "../notify/notifier";
import type { CalendarService } from "../calendar/calendar";

export interface Services {
  api: BramApi;
  plans: PlanRepository;
  topics: TopicRepository;
  prefs: PreferenceRepository;
  store: LifeStore;
  speaker: Speaker;
  voice: VoiceCapture;
  notifier: Notifier;
  calendar: CalendarService;
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
