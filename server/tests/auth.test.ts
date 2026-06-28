import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import type { NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

const llm: LlmClient = { chat: async () => "ok" };
const news: NewsClient = { fetchHeadlines: async () => [] };
const app = createApp({ llm, news, maxTokens: 256, clientSecret: "s3cret" });
const body = { system: "x", messages: [{ role: "user", content: "hi" }] };

describe("x-bram-key auth", () => {
  it("rejects a missing key with 401", async () => {
    const res = await request(app).post("/chat").send(body);
    expect(res.status).toBe(401);
  });

  it("rejects a wrong key with 401", async () => {
    const res = await request(app).post("/chat").set("x-bram-key", "nope").send(body);
    expect(res.status).toBe(401);
  });

  it("rejects a right prefix of the key with 401", async () => {
    const res = await request(app).post("/chat").set("x-bram-key", "s3cre").send(body);
    expect(res.status).toBe(401);
  });

  it("allows the correct key", async () => {
    const res = await request(app).post("/chat").set("x-bram-key", "s3cret").send(body);
    expect(res.status).toBe(200);
  });

  it("leaves /health open", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });
});
