import express, { type Request, type RequestHandler } from "express";
import { newsRouter } from "./routes/news";
import { chatRouter } from "./routes/chat";
import type { NewsClient } from "./services/news";
import type { LlmClient } from "./services/llm";

/** Verifies an access token and resolves to the user id; throws when invalid. */
export type TokenVerifier = (token: string) => Promise<string>;

export interface AppDeps {
  llm: LlmClient;
  news: NewsClient;
  maxTokens: number;
  rateLimit?: RequestHandler;
  verifyToken?: TokenVerifier;
}

/** Rate-limit key: the authenticated user id, or the IP before auth is configured. */
export function userRateLimitKey(req: Request): string {
  return (req as Request & { userId?: string }).userId ?? req.ip ?? "";
}

function requireUser(verify: TokenVerifier): RequestHandler {
  return async (req, res, next) => {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    if (!token) return void res.status(401).json({ error: "unauthorized" });
    try {
      (req as Request & { userId?: string }).userId = await verify(token);
      next();
    } catch {
      res.status(401).json({ error: "unauthorized" });
    }
  };
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.get("/health", (_req, res) => res.json({ ok: true })); // open: liveness checks
  if (deps.verifyToken) app.use(requireUser(deps.verifyToken));
  // After auth so the limiter can key on the user id, not the (spoofable) IP.
  if (deps.rateLimit) app.use(deps.rateLimit);
  app.use(newsRouter(deps.news));
  app.use(chatRouter(deps.llm, deps.maxTokens));
  return app;
}
