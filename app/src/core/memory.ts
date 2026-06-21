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
