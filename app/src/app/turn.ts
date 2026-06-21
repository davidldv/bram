import type { BramApi } from "../core/api";
import type {
  PlanRepository,
  PreferenceRepository,
  TopicRepository,
  MemoryRepository,
} from "../core/repository";
import type { Notifier } from "../notify/notifier";
import type { CalendarService } from "../calendar/calendar";
import { morningBriefing } from "../core/briefing-service";
import { capturePlans } from "../core/capture-service";
import { buildChatSystemPrompt, getPersonaName } from "../core/persona";
import { isRememberIntent, stripRememberLead, buildRecall } from "../core/memory";

export type TurnResult =
  | { kind: "briefing"; text: string }
  | { kind: "capture"; text: string; count: number }
  | { kind: "remember"; text: string }
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
    memories: MemoryRepository;
    notifier: Notifier;
    calendar: CalendarService;
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
      calendar: deps.calendar,
      now: deps.now,
    });
    return { kind: "briefing", text };
  }

  // "Remember that…" → store a durable fact. Checked before capture so it isn't
  // parsed as a plan. Empty fact (nothing after the lead) falls through to chat.
  if (isRememberIntent(utterance)) {
    const fact = stripRememberLead(utterance);
    if (fact) {
      await deps.memories.add({ id: deps.newId(), text: fact, createdAt: deps.now });
      return { kind: "remember", text: "Got it — I'll remember that." };
    }
  }

  const captured = await capturePlans(
    { api: deps.api, repo: deps.plans, notifier: deps.notifier, now: deps.now, newId: deps.newId },
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
  const recall = buildRecall(await deps.memories.list());
  const text = await deps.api.chat(buildChatSystemPrompt(persona, recall), [
    { role: "user", content: utterance },
  ]);
  return { kind: "chat", text };
}
