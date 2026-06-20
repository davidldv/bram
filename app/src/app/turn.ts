import type { BramApi } from "../core/api";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
} from "../core/repository";
import { morningBriefing } from "../core/briefing-service";
import { capturePlans } from "../core/capture-service";
import { buildChatSystemPrompt, getPersonaName } from "../core/persona";

export type TurnResult =
  | { kind: "briefing"; text: string }
  | { kind: "capture"; text: string; count: number }
  | { kind: "chat"; text: string };

export function isBriefingIntent(utterance: string): boolean {
  const u = utterance.toLowerCase();
  return /\b(good morning|morning|brief|briefing|what'?s (on|up|today)|my day|today)\b/.test(u);
}

export async function runTurn(
  deps: {
    api: BramApi;
    plans: PlanRepository;
    topics: TopicRepository;
    prefs: PreferenceRepository;
    now: number;
    newId: () => string;
  },
  utterance: string
): Promise<TurnResult> {
  if (isBriefingIntent(utterance)) {
    const text = await morningBriefing({
      api: deps.api,
      plans: deps.plans,
      topics: deps.topics,
      prefs: deps.prefs,
      now: deps.now,
    });
    return { kind: "briefing", text };
  }

  const captured = await capturePlans(
    { api: deps.api, repo: deps.plans, now: deps.now, newId: deps.newId },
    utterance
  );
  if (captured.length) {
    return {
      kind: "capture",
      text: `Got it — ${captured.map((p) => p.title).join(", ")}.`,
      count: captured.length,
    };
  }

  // Nothing to capture and not a briefing → just talk back as the persona.
  // ponytail: capture-first means 2 LLM calls per chat turn; add an intent
  // classifier (one call) if free-tier rate limits start biting.
  const persona = await getPersonaName(deps.prefs);
  const text = await deps.api.chat(buildChatSystemPrompt(persona), [
    { role: "user", content: utterance },
  ]);
  return { kind: "chat", text };
}
