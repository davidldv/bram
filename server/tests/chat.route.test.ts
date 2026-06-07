import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import type { NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

const stubNews: NewsClient = { fetchHeadlines: async () => [] };

function appWithLlm(llm: LlmClient) {
  return createApp({ llm, news: stubNews, maxTokens: 256 });
}

describe("POST /chat", () => {
  it("returns the model reply", async () => {
    const llm: LlmClient = { chat: async () => "Hello, David." };
    const res = await request(appWithLlm(llm))
      .post("/chat")
      .send({ system: "be brief", messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "Hello, David." });
  });

  it("returns 400 on invalid body", async () => {
    const llm: LlmClient = { chat: async () => "unused" };
    const res = await request(appWithLlm(llm)).post("/chat").send({ messages: "nope" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_request" });
  });

  it("returns 502 when the model throws", async () => {
    const llm: LlmClient = { chat: async () => { throw new Error("down"); } };
    const res = await request(appWithLlm(llm))
      .post("/chat")
      .send({ system: "x", messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "llm_unavailable" });
  });
});
