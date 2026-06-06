export interface Config {
  anthropicApiKey: string;
  newsApiKey: string;
  model: string;
  port: number;
  rateLimitMax: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const anthropicApiKey = env.ANTHROPIC_API_KEY;
  const newsApiKey = env.NEWS_API_KEY;
  if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is required");
  if (!newsApiKey) throw new Error("NEWS_API_KEY is required");
  return {
    anthropicApiKey,
    newsApiKey,
    model: env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001",
    port: Number(env.PORT ?? 3000),
    rateLimitMax: Number(env.RATE_LIMIT_MAX ?? 30),
  };
}
