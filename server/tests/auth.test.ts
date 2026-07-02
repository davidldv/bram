import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import type { NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

const llm: LlmClient = { chat: async () => "ok" };
const news: NewsClient = { fetchHeadlines: async () => [] };
// Fake verifier: accepts "token-<userId>", rejects everything else.
const verifyToken = async (token: string): Promise<string> => {
  if (!token.startsWith("token-")) throw new Error("invalid token");
  return token.slice("token-".length);
};
const app = createApp({ llm, news, maxTokens: 256, verifyToken });
const body = { system: "x", messages: [{ role: "user", content: "hi" }] };

describe("supabase jwt auth", () => {
  it("rejects a missing Authorization header with 401", async () => {
    const res = await request(app).post("/chat").send(body);
    expect(res.status).toBe(401);
  });

  it("rejects a non-Bearer Authorization header with 401", async () => {
    const res = await request(app).post("/chat").set("Authorization", "Basic abc").send(body);
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token with 401", async () => {
    const res = await request(app).post("/chat").set("Authorization", "Bearer nope").send(body);
    expect(res.status).toBe(401);
  });

  it("allows a valid token", async () => {
    const res = await request(app)
      .post("/chat")
      .set("Authorization", "Bearer token-user1")
      .send(body);
    expect(res.status).toBe(200);
  });

  it("protects /news too", async () => {
    const res = await request(app).post("/news").send({ topics: ["tech"] });
    expect(res.status).toBe(401);
  });

  it("leaves /health open", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });
});
