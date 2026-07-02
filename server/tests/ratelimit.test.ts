import { describe, it, expect } from "vitest";
import request from "supertest";
import rateLimit from "express-rate-limit";
import { createApp, userRateLimitKey } from "../src/server";
import type { NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

const stubNews: NewsClient = { fetchHeadlines: async () => [] };
const stubLlm: LlmClient = { chat: async () => "ok" };
const verifyToken = async (token: string): Promise<string> => {
  if (!token.startsWith("token-")) throw new Error("invalid token");
  return token.slice("token-".length);
};
const body = { system: "x", messages: [{ role: "user", content: "hi" }] };

function makeApp() {
  return createApp({
    llm: stubLlm,
    news: stubNews,
    maxTokens: 256,
    verifyToken,
    rateLimit: rateLimit({
      windowMs: 60_000,
      max: 2,
      standardHeaders: true,
      keyGenerator: userRateLimitKey,
    }),
  });
}

describe("per-user rate limiting", () => {
  it("returns 429 once one user exceeds the limit", async () => {
    const app = makeApp();
    const asUser1 = () =>
      request(app).post("/chat").set("Authorization", "Bearer token-user1").send(body);

    await asUser1().expect(200);
    await asUser1().expect(200);
    const third = await asUser1();

    expect(third.status).toBe(429);
  });

  it("does not throttle a different user", async () => {
    const app = makeApp();
    const asUser = (u: string) =>
      request(app).post("/chat").set("Authorization", `Bearer token-${u}`).send(body);

    await asUser("user1").expect(200);
    await asUser("user1").expect(200);
    await asUser("user1").expect(429);

    const other = await asUser("user2");
    expect(other.status).toBe(200);
  });

  it("does not rate-limit /health", async () => {
    const app = makeApp();
    await request(app).get("/health").expect(200);
    await request(app).get("/health").expect(200);
    await request(app).get("/health").expect(200);
  });
});
