import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import type { Headline, NewsClient } from "../src/services/news";
import type { LlmClient } from "../src/services/llm";

const stubLlm: LlmClient = { chat: async () => "unused" };

function appWithNews(news: NewsClient) {
  return createApp({ llm: stubLlm, news, maxTokens: 256 });
}

describe("POST /news", () => {
  it("returns headlines from the client", async () => {
    const headlines: Headline[] = [{ title: "T", source: "S", url: "http://a" }];
    const news: NewsClient = { fetchHeadlines: async () => headlines };

    const res = await request(appWithNews(news)).post("/news").send({ topics: ["tech"] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ headlines });
  });

  it("returns 502 when the news client throws", async () => {
    const news: NewsClient = { fetchHeadlines: async () => { throw new Error("down"); } };

    const res = await request(appWithNews(news)).post("/news").send({ topics: ["tech"] });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "news_unavailable" });
  });
});
