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

const FACTS_SENTINEL = "<<FACTS>>";

// Splits a chat reply into the spoken text and any facts the model appended
// after a `<<FACTS>>` line. Tolerant: anything unparseable yields no facts and
// the whole text is kept as the reply, so extraction never breaks a conversation.
export function parseChatReply(raw: string): { reply: string; facts: string[] } {
  const lines = raw.split("\n");
  const idx = lines.findIndex((l) => l.trim() === FACTS_SENTINEL);
  if (idx === -1) return { reply: raw.trim(), facts: [] };

  const reply = lines.slice(0, idx).join("\n").trim();
  const rest = lines.slice(idx + 1).join("\n").trim();
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
