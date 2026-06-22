import { deriveLinks } from "../src/core/linking";
import type { Entity, LifeEvent } from "../src/core/types";

function ent(id: string, name: string): Entity {
  return { id, type: "person", name, attributes: null, lastMentionedAt: 0, createdAt: 0 };
}
function ev(id: string, text: string): LifeEvent {
  return { id, text, occurredAt: null, createdAt: 0 };
}

describe("deriveLinks", () => {
  it("links an event to a known entity named in its text", () => {
    const links = deriveLinks({ entities: [], events: [ev("v1", "booked Germany trip with Mika")] }, [ent("e1", "Mika")]);
    expect(links).toEqual([["v1", "e1"]]);
  });

  it("does not link on a substring (whole-word match only)", () => {
    const links = deriveLinks({ entities: [], events: [ev("v1", "ate a banana")] }, [ent("e1", "Ana")]);
    expect(links).toEqual([]);
  });

  it("links every same-turn entity to every same-turn event", () => {
    const links = deriveLinks(
      { entities: [ent("e1", "Mika")], events: [ev("v1", "researched flights")] },
      []
    );
    expect(links).toEqual([["v1", "e1"]]);
  });

  it("does not duplicate a pair matched both by name and same-turn", () => {
    const links = deriveLinks(
      { entities: [ent("e1", "Mika")], events: [ev("v1", "trip with Mika")] },
      []
    );
    expect(links).toEqual([["v1", "e1"]]);
  });

  it("returns nothing when there are no events", () => {
    expect(deriveLinks({ entities: [ent("e1", "Mika")], events: [] }, [])).toEqual([]);
  });
});
