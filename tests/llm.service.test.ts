import { describe, it, expect, vi } from "vitest";
import { createLlmClient } from "../src/services/llm";

describe("createLlmClient", () => {
  it("sends system + messages and returns joined text", async () => {
    const create = vi.fn(async () => ({
      content: [
        { type: "text", text: "Good " },
        { type: "text", text: "morning." },
      ],
    }));
    const anthropic = { messages: { create } } as any;

    const client = createLlmClient({ apiKey: "k", model: "claude-haiku-4-5-20251001", anthropic });
    const reply = await client.chat("be brief", [{ role: "user", content: "hi" }], 256);

    expect(reply).toBe("Good morning.");
    expect(create).toHaveBeenCalledWith({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: "be brief",
      messages: [{ role: "user", content: "hi" }],
    });
  });
});
