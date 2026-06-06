import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("loads valid env with defaults", () => {
    const cfg = loadConfig({ ANTHROPIC_API_KEY: "a", NEWS_API_KEY: "n" });
    expect(cfg.anthropicApiKey).toBe("a");
    expect(cfg.newsApiKey).toBe("n");
    expect(cfg.model).toBe("claude-haiku-4-5-20251001");
    expect(cfg.port).toBe(3000);
    expect(cfg.rateLimitMax).toBe(30);
  });

  it("throws when ANTHROPIC_API_KEY is missing", () => {
    expect(() => loadConfig({ NEWS_API_KEY: "n" })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("throws when NEWS_API_KEY is missing", () => {
    expect(() => loadConfig({ ANTHROPIC_API_KEY: "a" })).toThrow(/NEWS_API_KEY/);
  });

  it("respects overrides", () => {
    const cfg = loadConfig({
      ANTHROPIC_API_KEY: "a", NEWS_API_KEY: "n",
      CLAUDE_MODEL: "claude-sonnet-4-6", PORT: "8080", RATE_LIMIT_MAX: "5",
    });
    expect(cfg.model).toBe("claude-sonnet-4-6");
    expect(cfg.port).toBe(8080);
    expect(cfg.rateLimitMax).toBe(5);
  });
});
