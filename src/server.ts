import express, { type RequestHandler } from "express";
import { newsRouter } from "./routes/news";
import { chatRouter } from "./routes/chat";
import type { NewsClient } from "./services/news";
import type { LlmClient } from "./services/llm";

export interface AppDeps {
  llm: LlmClient;
  news: NewsClient;
  maxTokens: number;
  rateLimit?: RequestHandler;
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  if (deps.rateLimit) app.use(deps.rateLimit);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use(newsRouter(deps.news));
  app.use(chatRouter(deps.llm, deps.maxTokens));
  return app;
}
