export interface Config {
  anthropicApiKey: string;
  newsApiKey: string;
  model: string;
  port: number;
  rateLimitMax: number;
}

function numberFromEnv(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number, got "${value}"`);
  return n;
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
    port: numberFromEnv(env.PORT, "PORT", 3000),
    rateLimitMax: numberFromEnv(env.RATE_LIMIT_MAX, "RATE_LIMIT_MAX", 30),
  };
}
