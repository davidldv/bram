import rateLimit from "express-rate-limit";
import { loadConfig } from "./config";
import { createApp } from "./server";
import { createLlmClient } from "./services/llm";
import { createNewsClient } from "./services/news";

function main() {
  const cfg = loadConfig();

  const app = createApp({
    llm: createLlmClient({ apiKey: cfg.anthropicApiKey, model: cfg.model }),
    news: createNewsClient({ apiKey: cfg.newsApiKey }),
    maxTokens: 1024,
    rateLimit: rateLimit({ windowMs: 60_000, max: cfg.rateLimitMax, standardHeaders: true }),
  });

  app.listen(cfg.port, () => {
    console.log(`bram proxy listening on :${cfg.port}`);
  });
}

try {
  main();
} catch (err) {
  console.error(`bram proxy failed to start: ${(err as Error).message}`);
  process.exit(1);
}
