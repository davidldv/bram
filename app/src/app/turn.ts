import type { BramApi } from "../core/api";
import type { PlanRepository, PreferenceRepository, TopicRepository } from "../core/repository";
import type { LifeStore } from "../core/life-store";
import type { Notifier } from "../notify/notifier";
import type { CalendarService } from "../calendar/calendar";
import type { Entity, LifeEvent } from "../core/types";
import { morningBriefing } from "../core/briefing-service";
import { capturePlans } from "../core/capture-service";
import { buildChatSystemPrompt, getPersonaName } from "../core/persona";
import { isRememberIntent, stripRememberLead, parseChatReply, parseRoughDate } from "../core/memory";
import { deriveLinks } from "../core/linking";
import { tokenize, buildContext, type ContextSnapshot } from "../core/context";

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
    store: LifeStore;
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

  // "Remember that…" → store a durable fact entity. Checked before capture.
  if (isRememberIntent(utterance)) {
    const fact = stripRememberLead(utterance);
    if (fact) {
      await deps.store.upsertEntity("fact", fact, null, deps.now, deps.newId);
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

  // Conversational turn: inject a relevant slice of the life-model, then extract
  // any new typed items the model surfaced and link them.
  // ponytail: capture-first means 2 LLM calls per chat turn; add an intent
  // classifier (one call) if free-tier rate limits start biting.
  const persona = await getPersonaName(deps.prefs);
  const tokens = tokenize(utterance);
  const snapshot: ContextSnapshot = {
    people: await deps.store.people(),
    goals: await deps.store.goals(),
    recentEvents: await deps.store.recentEvents(10),
    searchHits: await deps.store.search(tokens),
  };
  const recall = buildContext(snapshot);
  const raw = await deps.api.chat(buildChatSystemPrompt(persona, recall), [
    { role: "user", content: utterance },
  ]);
  const { reply, items } = parseChatReply(raw);

  const turnEntities: Entity[] = [];
  const turnEvents: LifeEvent[] = [];
  for (const item of items) {
    if (item.kind === "event") {
      turnEvents.push(await deps.store.addEvent(item.text, parseRoughDate(item.date), deps.now, deps.newId));
    } else {
      turnEntities.push(
        await deps.store.upsertEntity(item.type, item.text, item.attributes ?? null, deps.now, deps.newId)
      );
    }
  }
  if (turnEvents.length) {
    const known = [...(await deps.store.people()), ...(await deps.store.goals()), ...(await deps.store.facts())];
    for (const [from, to] of deriveLinks({ entities: turnEntities, events: turnEvents }, known)) {
      await deps.store.link(from, to);
    }
  }

  return { kind: "chat", text: reply };
}
