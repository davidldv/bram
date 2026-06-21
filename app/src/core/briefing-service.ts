import type { BramApi } from "./api";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
} from "./repository";
import type { CalendarService } from "../calendar/calendar";
import { buildBriefingPrompt } from "./briefing";
import { getPersonaName } from "./persona";

export function dayRange(now: number): { startMs: number; endMs: number } {
  const d = new Date(now);
  const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

export async function morningBriefing(deps: {
  api: BramApi;
  plans: PlanRepository;
  topics: TopicRepository;
  prefs: PreferenceRepository;
  calendar: CalendarService;
  now: number;
}): Promise<string> {
  const enabledTopics = (await deps.topics.list())
    .filter((t) => t.enabled)
    .map((t) => t.label);
  // With no topics enabled, skip the news call rather than fetch generic
  // "top" headlines the user didn't ask for.
  const headlines = enabledTopics.length ? await deps.api.news(enabledTopics) : [];

  const { startMs, endMs } = dayRange(deps.now);
  const plans = await deps.plans.listForRange(startMs, endMs);
  const events = await deps.calendar.listEvents(startMs, endMs);

  const persona = await getPersonaName(deps.prefs);
  const dateLabel = new Date(deps.now).toDateString();

  const { system, messages } = buildBriefingPrompt({ persona, dateLabel, plans, events, headlines });
  return deps.api.chat(system, messages);
}
