import type { Entity, LifeEvent } from "./types";

// Whole-word, case-insensitive presence of `name` in `text`.
function mentions(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // `name` is fully regex-escaped above, so no attacker-controlled quantifiers/alternation
  // survive into the pattern — no ReDoS path (a literal wrapped in \b…\b).
  return new RegExp(`\\b${escaped}\\b`, "i").test(text); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
}

// Derives [eventId, entityId] links: an event links to any entity named in its
// text (known or just-added), and to every entity created in the same turn.
export function deriveLinks(
  turn: { entities: Entity[]; events: LifeEvent[] },
  known: Entity[]
): Array<[string, string]> {
  const links: Array<[string, string]> = [];
  const seen = new Set<string>();
  const add = (from: string, to: string) => {
    const key = `${from}|${to}`;
    if (from !== to && !seen.has(key)) {
      seen.add(key);
      links.push([from, to]);
    }
  };

  const allEntities = [...known, ...turn.entities];
  for (const event of turn.events) {
    for (const entity of allEntities) {
      if (entity.name && mentions(event.text, entity.name)) add(event.id, entity.id);
    }
    for (const entity of turn.entities) add(event.id, entity.id);
  }
  return links;
}
