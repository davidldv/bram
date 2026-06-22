import type { Memory } from "./types";

// Leading phrases that mean "store this as a durable fact about me".
const LEAD = /^\s*(?:please\s+)?(?:remember|note|keep in mind|don'?t forget)(?:\s+that)?\b[:,]?\s*/i;

export function isRememberIntent(utterance: string): boolean {
  return LEAD.test(utterance);
}

export function stripRememberLead(utterance: string): string {
  return utterance.replace(LEAD, "").trim();
}

export function buildRecall(memories: Memory[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- ${m.text}`).join("\n");
  return `Things you know about the user:\n${lines}`;
}

export const FACTS_SENTINEL = "<<FACTS>>";

// Splits a chat reply into the spoken text and any facts the model appended
// after the `<<FACTS>>` sentinel. Splits on the sentinel wherever it appears —
// free models emit it inline (same line as the reply, JSON right after it), not
// on its own line. Tolerant: anything unparseable yields no facts and the whole
// text is kept as the reply, so extraction never breaks a conversation.
export function parseChatReply(raw: string): { reply: string; facts: string[] } {
  const idx = raw.indexOf(FACTS_SENTINEL);
  if (idx === -1) return { reply: raw.trim(), facts: [] };

  const reply = raw.slice(0, idx).trim();
  const rest = raw.slice(idx + FACTS_SENTINEL.length).trim();
  let facts: string[] = [];
  try {
    const parsed = JSON.parse(rest);
    if (Array.isArray(parsed)) {
      facts = parsed
        .filter((f): f is string => typeof f === "string")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
    }
  } catch {
    facts = [];
  }
  return { reply, facts };
}

// Appended to the chat system prompt. Tells the model to surface durable facts
// and standing preferences after its spoken reply, using the FACTS_SENTINEL
// protocol that parseChatReply understands.
export function buildExtractionInstructions(): string {
  return [
    "After your spoken reply, if the user revealed a durable fact about themselves",
    "(identity, relationships, lasting preferences) or a standing preference for how",
    "you should behave, AND it is not already in the list above, append a line",
    `containing exactly ${FACTS_SENTINEL} and then a JSON array of short fact strings.`,
    "Capture at most 3, only new ones not already mentioned. Skip transient moods,",
    "one-off mentions, and anything already known. If there is nothing new, write",
    `nothing after your reply. Never mention ${FACTS_SENTINEL} or the facts in your`,
    "spoken reply.",
  ].join("\n");
}
