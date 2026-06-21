import type { ChatMessage, Headline, Plan, CalendarEvent } from "./types";

export function buildBriefingPrompt(input: {
  persona: string;
  dateLabel: string;
  plans: Plan[];
  events?: CalendarEvent[];
  headlines: Headline[];
}): { system: string; messages: ChatMessage[] } {
  const system = [
    `You are ${input.persona}, a warm, concise personal assistant.`,
    "Give a short spoken morning briefing.",
    "Cover, in order: a one-line greeting, today's calendar and plans, then the headlines.",
    "Keep it natural and brief — this will be read aloud.",
  ].join("\n");

  const events = input.events ?? [];
  const calendarLines = events.length
    ? events.map((e) => `- ${formatEvent(e)}`).join("\n")
    : "- (nothing scheduled)";
  const planLines = input.plans.length
    ? input.plans.map((p) => `- ${formatPlan(p)}`).join("\n")
    : "- (no plans today)";
  const newsLines = input.headlines.length
    ? input.headlines.map((h) => `- ${h.title} (${h.source})`).join("\n")
    : "- (no headlines)";

  const content = [
    `Date: ${input.dateLabel}`,
    "",
    "Today's calendar:",
    calendarLines,
    "",
    "Today's plans:",
    planLines,
    "",
    "Headlines:",
    newsLines,
  ].join("\n");

  return { system, messages: [{ role: "user", content }] };
}

function formatEvent(e: CalendarEvent): string {
  if (e.allDay) return `all day ${e.title}`;
  return `${hhmm(e.startMs)} ${e.title}`;
}

function hhmm(ms: number): string {
  const t = new Date(ms);
  return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
}

function formatPlan(p: Plan): string {
  if (p.scheduledAt === null) return p.title;
  const t = new Date(p.scheduledAt);
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  return `${hh}:${mm} ${p.title}`;
}
