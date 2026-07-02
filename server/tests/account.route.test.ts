import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import type { NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

const llm: LlmClient = { chat: async () => "ok" };
const news: NewsClient = { fetchHeadlines: async () => [] };
const verifyToken = async (token: string): Promise<string> => {
  if (!token.startsWith("token-")) throw new Error("invalid token");
  return token.slice("token-".length);
};

describe("DELETE /account", () => {
  it("deletes the authenticated user and returns 204", async () => {
    const deleted: string[] = [];
    const admin = { deleteUser: async (id: string) => void deleted.push(id) };
    const app = createApp({ llm, news, maxTokens: 256, verifyToken, admin });

    const res = await request(app).delete("/account").set("Authorization", "Bearer token-user1");

    expect(res.status).toBe(204);
    expect(deleted).toEqual(["user1"]);
  });

  it("rejects a missing token with 401", async () => {
    const admin = { deleteUser: async () => {} };
    const app = createApp({ llm, news, maxTokens: 256, verifyToken, admin });

    const res = await request(app).delete("/account");

    expect(res.status).toBe(401);
  });

  it("returns 502 when upstream deletion fails", async () => {
    const admin = {
      deleteUser: async () => {
        throw new Error("supabase down");
      },
    };
    const app = createApp({ llm, news, maxTokens: 256, verifyToken, admin });

    const res = await request(app).delete("/account").set("Authorization", "Bearer token-user1");

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "deletion_failed" });
  });

  it("is absent when no admin client is configured", async () => {
    const app = createApp({ llm, news, maxTokens: 256, verifyToken });

    const res = await request(app).delete("/account").set("Authorization", "Bearer token-user1");

    expect(res.status).toBe(404);
  });
});
