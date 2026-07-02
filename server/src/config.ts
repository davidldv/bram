export interface Config {
  openrouterKeys: string[];
  newsApiKey: string;
  model: string;
  port: number;
  rateLimitMax: number;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
}

function numberFromEnv(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number, got "${value}"`);
  return n;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  // Primary + optional backups, tried in order on rate-limit/quota failures.
  const openrouterKeys = [
    env.OPENROUTER_API_KEY,
    env.OPENROUTER_BACKUP_KEY,
    env.OPENROUTER_BACKUP_KEY2,
  ].filter((k): k is string => !!k && k.trim() !== "");
  const newsApiKey = env.NEWS_API_KEY;
  if (openrouterKeys.length === 0) throw new Error("OPENROUTER_API_KEY is required");
  if (!newsApiKey) throw new Error("NEWS_API_KEY is required");
  return {
    openrouterKeys,
    newsApiKey,
    model: env.OPENROUTER_MODEL ?? "openai/gpt-oss-120b:free",
    port: numberFromEnv(env.PORT, "PORT", 3000),
    rateLimitMax: numberFromEnv(env.RATE_LIMIT_MAX, "RATE_LIMIT_MAX", 30),
    supabaseUrl: env.SUPABASE_URL?.trim().replace(/\/$/, "") || undefined,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined,
  };
}
