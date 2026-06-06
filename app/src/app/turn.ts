import type { BramApi } from "../core/api";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
} from "../core/repository";
import { morningBriefing } from "../core/briefing-service";
import { capturePlans } from "../core/capture-service";

export type TurnResult =
  | { kind: "briefing"; text: string }
  | { kind: "capture"; text: string; count: number };

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
  const text = captured.length
    ? `Got it — ${captured.map((p) => p.title).join(", ")}.`
    : "I didn't catch anything to save.";
  return { kind: "capture", text, count: captured.length };
}
