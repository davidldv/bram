import type { ExtractedItem } from "./types";

// Leading phrases that mean "store this as a durable fact about me".
const LEAD = /^\s*(?:please\s+)?(?:remember|note|keep in mind|don'?t forget)(?:\s+that)?\b[:,]?\s*/i;

export function isRememberIntent(utterance: string): boolean {
  return LEAD.test(utterance);
}

export function stripRememberLead(utterance: string): string {
  return utterance.replace(LEAD, "").trim();
}

export const FACTS_SENTINEL = "<<FACTS>>";

const MAX_ITEMS = 5;

function toItem(raw: unknown): ExtractedItem | null {
  if (typeof raw === "string") {
    const text = raw.trim();
    return text ? { kind: "entity", type: "fact", text } : null;
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!text) return null;
    if (o.type === "event") {
      const date = typeof o.date === "string" && o.date.trim() ? o.date.trim() : null;
      return { kind: "event", text, date };
    }
    if (o.type === "person" || o.type === "goal") {
      const attrs = o.attributes && typeof o.attributes === "object" ? (o.attributes as Record<string, unknown>) : undefined;
      return attrs ? { kind: "entity", type: o.type, text, attributes: attrs } : { kind: "entity", type: o.type, text };
    }
    return { kind: "entity", type: "fact", text }; // missing / unknown type
  }
  return null;
}

// Splits a chat reply into the spoken text and any structured items the model
// appended after the `<<FACTS>>` sentinel (inline or own-line). Maximally
// tolerant: unparseable yields no items and keeps the whole text as the reply.
export function parseChatReply(raw: string): { reply: string; items: ExtractedItem[] } {
  const idx = raw.indexOf(FACTS_SENTINEL);
  if (idx === -1) return { reply: raw.trim(), items: [] };

  const reply = raw.slice(0, idx).trim();
  const rest = raw.slice(idx + FACTS_SENTINEL.length).trim();
  let items: ExtractedItem[] = [];
  try {
    const parsed = JSON.parse(rest);
    if (Array.isArray(parsed)) {
      items = parsed
        .map(toItem)
        .filter((x): x is ExtractedItem => x !== null)
        .slice(0, MAX_ITEMS);
    }
  } catch {
    items = [];
  }
  return { reply, items };
}

// Parses a rough date string ("YYYY-MM" or "YYYY-MM-DD") to epoch ms, or null.
export function parseRoughDate(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = m[3] ? Number(m[3]) : 1;
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return new Date(year, month, day).getTime();
}

// Appended to the chat system prompt: how to surface durable, new items.
export function buildExtractionInstructions(): string {
  return [
    `After your spoken reply, if the user revealed something durable and new (not`,
    `already listed above), append a line containing exactly ${FACTS_SENTINEL} then a JSON`,
    `array of objects. Each object has a "type" and a "text":`,
    `- {"type":"person","text":"Mika"} for a person in their life`,
    `- {"type":"goal","text":"visit Germany"} for a goal or plan they care about`,
    `- {"type":"event","text":"booked a Germany trip","date":"2026-07"} for something that happened (date optional, YYYY-MM or YYYY-MM-DD)`,
    `- {"type":"fact","text":"is vegetarian"} for any other durable fact or preference`,
    `Capture at most 5, only new ones. Skip transient moods and anything already known.`,
    `If there is nothing new, write nothing after your reply. Never mention ${FACTS_SENTINEL}`,
    `or the items in your spoken reply.`,
  ].join("\n");
}
