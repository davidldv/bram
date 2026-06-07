import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import type { NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

describe("GET /health", () => {
  it("reports ok", async () => {
    const app = createApp({
      llm: { chat: async () => "ok" } as LlmClient,
      news: { fetchHeadlines: async () => [] } as NewsClient,
      maxTokens: 256,
    });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
