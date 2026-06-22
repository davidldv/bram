import type { Entity, LifeEvent } from "./types";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "to", "of", "in", "on", "at",
  "is", "are", "was", "my", "you", "it", "this", "that", "with", "do", "what",
]);

export function tokenize(s: string): string[] {
  return Array.from(
    new Set(
      s.toLowerCase().split(/[^a-z0-9']+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    )
  );
}

export interface ContextSnapshot {
  people: Entity[];
  goals: Entity[];
  recentEvents: LifeEvent[];
  searchHits: (Entity | LifeEvent)[];
}

const CAP = 40;

function isEntity(x: Entity | LifeEvent): x is Entity {
  return (x as Entity).type !== undefined;
}

function monthLabel(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}: `;
}

function entityLine(e: Entity): string {
  const attrs = e.attributes
    ? Object.entries(e.attributes).map(([k, v]) => `${k} ${v}`).join(", ")
    : "";
  return attrs ? `- ${e.name} (${attrs})` : `- ${e.name}`;
}

function eventLine(e: LifeEvent): string {
  return `- ${monthLabel(e.occurredAt)}${e.text}`;
}

// Formats a bounded, relevant slice of the life-model for the chat prompt.
// Empty model → "" (same contract as the former buildRecall).
export function buildContext(snapshot: ContextSnapshot): string {
  const sections: string[] = [];
  const shown = new Set<string>();
  let used = 0;
  const room = () => Math.max(0, CAP - used);

  const take = <T extends { id: string }>(arr: T[]): T[] => {
    const out = arr.slice(0, room());
    for (const x of out) shown.add(x.id);
    used += out.length;
    return out;
  };

  const people = take(snapshot.people);
  if (people.length) sections.push("People you know:\n" + people.map(entityLine).join("\n"));

  const goals = take(snapshot.goals);
  if (goals.length) sections.push("Your goals:\n" + goals.map(entityLine).join("\n"));

  const recent = take(snapshot.recentEvents);
  if (recent.length) sections.push("Recent in your life:\n" + recent.map(eventLine).join("\n"));

  const hits = take(snapshot.searchHits.filter((x) => !shown.has(x.id)));
  if (hits.length) {
    const lines = hits.map((x) => (isEntity(x) ? entityLine(x) : eventLine(x)));
    sections.push("Related to what you said:\n" + lines.join("\n"));
  }

  return sections.join("\n\n");
}
