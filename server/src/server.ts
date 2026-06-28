import express, { type RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import { newsRouter } from "./routes/news";
import { chatRouter } from "./routes/chat";
import type { NewsClient } from "./services/news";
import type { LlmClient } from "./services/llm";

export interface AppDeps {
  llm: LlmClient;
  news: NewsClient;
  maxTokens: number;
  rateLimit?: RequestHandler;
  clientSecret?: string;
}

function requireClientSecret(secret: string): RequestHandler {
  const expected = Buffer.from(secret);
  return (req, res, next) => {
    const got = Buffer.from(req.header("x-bram-key") ?? "");
    if (got.length === expected.length && timingSafeEqual(got, expected)) return next();
    res.status(401).json({ error: "unauthorized" });
  };
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  if (deps.rateLimit) app.use(deps.rateLimit);
  app.get("/health", (_req, res) => res.json({ ok: true })); // open: liveness checks
  // ponytail: a shared secret shipped in the app binary is extractable, so this
  // only raises the bar from "anyone with the URL". Upgrade to Play Integrity /
  // App Attest if the endpoint actually gets abused.
  if (deps.clientSecret) app.use(requireClientSecret(deps.clientSecret));
  app.use(newsRouter(deps.news));
  app.use(chatRouter(deps.llm, deps.maxTokens));
  return app;
}
