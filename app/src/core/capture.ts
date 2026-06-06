import type { Plan, PlanType } from "./types";

export function buildCaptureSystemPrompt(nowIso: string): string {
  return [
    "You extract plans from the user's message.",
    `The current time is ${nowIso}.`,
    "Return ONLY a JSON array (no prose, no code fences).",
    'Each item: {"type": "reminder"|"event"|"task", "title": string, "scheduledAt": string|null}.',
    "scheduledAt is an ISO 8601 datetime, or null if no time is given.",
    "If there are no plans, return [].",
  ].join("\n");
}

interface RawItem {
  type?: string;
  title?: string;
  scheduledAt?: string | null;
}

const VALID_TYPES: PlanType[] = ["reminder", "event", "task"];

export function parseCapturedPlans(
  reply: string,
  deps: { now: number; newId: () => string }
): Plan[] {
  const text = stripFences(reply).trim();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const plans: Plan[] = [];
  for (const item of raw as RawItem[]) {
    if (!item || typeof item.title !== "string" || item.title.trim() === "") continue;
    const type = VALID_TYPES.includes(item.type as PlanType)
      ? (item.type as PlanType)
      : "task";
    let scheduledAt: number | null = null;
    if (typeof item.scheduledAt === "string") {
      const ms = Date.parse(item.scheduledAt);
      scheduledAt = Number.isNaN(ms) ? null : ms;
    }
    plans.push({
      id: deps.newId(),
      type,
      title: item.title.trim(),
      scheduledAt,
      createdAt: deps.now,
      done: false,
    });
  }
  return plans;
}

function stripFences(text: string): string {
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m);
  return m ? m[1] : text;
}
