import rateLimit from "express-rate-limit";
import { loadConfig } from "./config";
import { createApp, userRateLimitKey } from "./server";
import { createSupabaseVerifier } from "./auth";
import { createLlmClient } from "./services/llm";
import { createNewsClient } from "./services/news";
import { createSupabaseAdmin } from "./services/supabase-admin";

function main() {
  const cfg = loadConfig();
  if (!cfg.supabaseUrl) {
    console.warn("WARNING: SUPABASE_URL not set — /chat and /news accept anyone with the URL");
  }

  const app = createApp({
    llm: createLlmClient({ apiKeys: cfg.openrouterKeys, model: cfg.model }),
    news: createNewsClient({ apiKey: cfg.newsApiKey }),
    maxTokens: 1024,
    rateLimit: rateLimit({
      windowMs: 60_000,
      max: cfg.rateLimitMax,
      standardHeaders: true,
      keyGenerator: userRateLimitKey,
    }),
    verifyToken: cfg.supabaseUrl ? createSupabaseVerifier(cfg.supabaseUrl) : undefined,
    admin:
      cfg.supabaseUrl && cfg.supabaseServiceRoleKey
        ? createSupabaseAdmin({
            supabaseUrl: cfg.supabaseUrl,
            serviceRoleKey: cfg.supabaseServiceRoleKey,
          })
        : undefined,
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
