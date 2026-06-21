import { isRememberIntent, stripRememberLead, buildRecall } from "../src/core/memory";
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
