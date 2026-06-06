import { describe, it, expect } from "vitest";
import request from "supertest";
import rateLimit from "express-rate-limit";
import { createApp } from "../src/server";
import type { NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

const stubNews: NewsClient = { fetchHeadlines: async () => [] };
const stubLlm: LlmClient = { chat: async () => "ok" };

describe("rate limiting", () => {
  it("returns 429 after the limit is exceeded", async () => {
    const app = createApp({
      llm: stubLlm,
      news: stubNews,
      maxTokens: 256,
      rateLimit: rateLimit({ windowMs: 60_000, max: 2, standardHeaders: true }),
    });

    await request(app).get("/health").expect(200);
    await request(app).get("/health").expect(200);
    const third = await request(app).get("/health");

    expect(third.status).toBe(429);
  });
});
