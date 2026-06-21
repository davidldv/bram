import { describe, it, expect, vi } from "vitest";
import { createLlmClient } from "../src/services/llm";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createLlmClient", () => {
  it("sends system as a message and returns the choice content", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: "Good morning." } }] })
    );

    const client = createLlmClient({
      apiKeys: ["k"],
      model: "deepseek/deepseek-chat-v3-0324:free",
      fetchFn: fetchFn as unknown as typeof fetch,
      endpoint: "https://router.test/chat",
    });
    const reply = await client.chat("be brief", [{ role: "user", content: "hi" }], 256);

    expect(reply).toBe("Good morning.");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://router.test/chat");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer k" });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      model: "deepseek/deepseek-chat-v3-0324:free",
      max_tokens: 256,
      messages: [
        { role: "system", content: "be brief" },
        { role: "user", content: "hi" },
      ],
    });
  });

  it("fails over to the next key on a 429", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "hi there" } }] }));

    const client = createLlmClient({
      apiKeys: ["bad", "good"],
      model: "m",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const reply = await client.chat("s", [{ role: "user", content: "yo" }], 64);

    expect(reply).toBe("hi there");
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect((fetchFn.mock.calls[1][1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer good",
    });
  });

  it("throws after all keys fail", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, 429));
    const client = createLlmClient({
      apiKeys: ["a", "b"],
      model: "m",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(client.chat("s", [{ role: "user", content: "x" }], 64)).rejects.toThrow(/429/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does not fail over on a 400 (request bug)", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: "bad model" }, 400));
    const client = createLlmClient({
      apiKeys: ["a", "b"],
      model: "m",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(client.chat("s", [{ role: "user", content: "x" }], 64)).rejects.toThrow(/400/);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
