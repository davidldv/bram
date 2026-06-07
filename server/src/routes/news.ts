import { Router } from "express";
import type { NewsClient } from "../services/news";

export function newsRouter(news: NewsClient): Router {
  const r = Router();
  r.post("/news", async (req, res) => {
    const topics = Array.isArray(req.body?.topics) ? req.body.topics : [];
    try {
      const headlines = await news.fetchHeadlines(topics);
      res.json({ headlines });
    } catch {
      res.status(502).json({ error: "news_unavailable" });
    }
  });
  return r;
}
