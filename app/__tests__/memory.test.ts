import { isRememberIntent, stripRememberLead, buildRecall, parseChatReply, parseRoughDate, buildExtractionInstructions } from "../src/core/memory";
import type { Memory } from "../src/core/types";

describe("isRememberIntent", () => {
  it("matches remember phrases", () => {
    expect(isRememberIntent("remember that my wife is Ana")).toBe(true);
    expect(isRememberIntent("Remember my gym is on 5th")).toBe(true);
    expect(isRememberIntent("don't forget that I'm vegetarian")).toBe(true);
    expect(isRememberIntent("note that I take meds at 9")).toBe(true);
    expect(isRememberIntent("keep in mind I hate cilantro")).toBe(true);
  });
  it("rejects non-remember utterances", () => {
    expect(isRememberIntent("remind me to call Ana")).toBe(false);
    expect(isRememberIntent("what's on today")).toBe(false);
    expect(isRememberIntent("how are you")).toBe(false);
  });
});

describe("stripRememberLead", () => {
  it("removes the lead phrase and trims", () => {
    expect(stripRememberLead("remember that my wife is Ana")).toBe("my wife is Ana");
    expect(stripRememberLead("don't forget I'm vegetarian")).toBe("I'm vegetarian");
    expect(stripRememberLead("note that: I take meds at 9")).toBe("I take meds at 9");
  });
  it("returns empty when there is nothing after the lead", () => {
    expect(stripRememberLead("remember that")).toBe("");
  });
});

describe("buildRecall", () => {
  it("returns empty string for no memories", () => {
    expect(buildRecall([])).toBe("");
  });
  it("formats a bulleted block", () => {
    const mems: Memory[] = [
      { id: "1", text: "my wife is Ana", createdAt: 1 },
      { id: "2", text: "I take meds at 9am", createdAt: 2 },
    ];
    expect(buildRecall(mems)).toBe(
      "Things you know about the user:\n- my wife is Ana\n- I take meds at 9am"
    );
  });
});

describe("parseChatReply", () => {
  it("returns reply only when there is no sentinel", () => {
    expect(parseChatReply("Hello there.")).toEqual({ reply: "Hello there.", items: [] });
  });

  it("treats a plain string item as a fact entity (back-compat)", () => {
    const raw = 'Sure.\n<<FACTS>>\n["is vegetarian"]';
    expect(parseChatReply(raw)).toEqual({
      reply: "Sure.",
      items: [{ kind: "entity", type: "fact", text: "is vegetarian" }],
    });
  });

  it("parses typed person / goal / event objects from an inline sentinel", () => {
    const raw = 'Got it. <<FACTS>>[{"type":"person","text":"Mika"},{"type":"goal","text":"visit Germany"},{"type":"event","text":"booked Germany trip","date":"2026-07"}]';
    expect(parseChatReply(raw)).toEqual({
      reply: "Got it.",
      items: [
        { kind: "entity", type: "person", text: "Mika" },
        { kind: "entity", type: "goal", text: "visit Germany" },
        { kind: "event", text: "booked Germany trip", date: "2026-07" },
      ],
    });
  });

  it("keeps person attributes when present", () => {
    const raw = 'Ok. <<FACTS>>[{"type":"person","text":"Mika","attributes":{"birthday":"10-12"}}]';
    expect(parseChatReply(raw).items).toEqual([
      { kind: "entity", type: "person", text: "Mika", attributes: { birthday: "10-12" } },
    ]);
  });

  it("demotes missing or unknown type to a fact", () => {
    const raw = 'Hi. <<FACTS>>[{"text":"likes sushi"},{"type":"pet","text":"has a dog"}]';
    expect(parseChatReply(raw).items).toEqual([
      { kind: "entity", type: "fact", text: "likes sushi" },
      { kind: "entity", type: "fact", text: "has a dog" },
    ]);
  });

  it("treats an event with no date as date null", () => {
    const raw = 'Ok. <<FACTS>>[{"type":"event","text":"got a new job"}]';
    expect(parseChatReply(raw).items).toEqual([{ kind: "event", text: "got a new job", date: null }]);
  });

  it("drops items with no usable text and trims text", () => {
    const raw = 'Done. <<FACTS>>[{"type":"person","text":"  Ana  "},{"type":"fact","text":""},5]';
    expect(parseChatReply(raw).items).toEqual([{ kind: "entity", type: "person", text: "Ana" }]);
  });

  it("keeps the reply and yields no items on malformed JSON", () => {
    expect(parseChatReply("Okay. <<FACTS>>[not json")).toEqual({ reply: "Okay.", items: [] });
  });

  it("caps at 5 items per turn", () => {
    const raw = 'Ok. <<FACTS>>[{"type":"fact","text":"a"},{"type":"fact","text":"b"},{"type":"fact","text":"c"},{"type":"fact","text":"d"},{"type":"fact","text":"e"},{"type":"fact","text":"f"}]';
    expect(parseChatReply(raw).items.map((i) => (i.kind === "entity" ? i.text : ""))).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("parseRoughDate", () => {
  it("parses YYYY-MM to the first of that month", () => {
    expect(parseRoughDate("2026-07")).toBe(new Date(2026, 6, 1).getTime());
  });
  it("parses YYYY-MM-DD", () => {
    expect(parseRoughDate("2026-07-12")).toBe(new Date(2026, 6, 12).getTime());
  });
  it("returns null for null, empty, or garbage", () => {
    expect(parseRoughDate(null)).toBeNull();
    expect(parseRoughDate("")).toBeNull();
    expect(parseRoughDate("next week")).toBeNull();
    expect(parseRoughDate("2026-13")).toBeNull();
  });
});

describe("buildExtractionInstructions", () => {
  it("documents the typed object format and the sentinel", () => {
    const text = buildExtractionInstructions();
    expect(text).toContain("<<FACTS>>");
    expect(text).toContain('"type"');
    expect(text).toMatch(/only new/i);
  });
});
