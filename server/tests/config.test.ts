import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("loads valid env with defaults", () => {
    const cfg = loadConfig({ OPENROUTER_API_KEY: "a", NEWS_API_KEY: "n" });
    expect(cfg.openrouterKeys).toEqual(["a"]);
    expect(cfg.newsApiKey).toBe("n");
    expect(cfg.model).toBe("openai/gpt-oss-120b:free");
    expect(cfg.port).toBe(3000);
    expect(cfg.rateLimitMax).toBe(30);
  });

  it("collects backup keys in order, skipping blanks", () => {
    const cfg = loadConfig({
      OPENROUTER_API_KEY: "a",
      OPENROUTER_BACKUP_KEY: "  ",
      OPENROUTER_BACKUP_KEY2: "c",
      NEWS_API_KEY: "n",
    });
    expect(cfg.openrouterKeys).toEqual(["a", "c"]);
  });

  it("throws when OPENROUTER_API_KEY is missing", () => {
    expect(() => loadConfig({ NEWS_API_KEY: "n" })).toThrow(/OPENROUTER_API_KEY/);
  });

  it("throws when NEWS_API_KEY is missing", () => {
    expect(() => loadConfig({ OPENROUTER_API_KEY: "a" })).toThrow(/NEWS_API_KEY/);
  });

  it("respects overrides", () => {
    const cfg = loadConfig({
      OPENROUTER_API_KEY: "a", NEWS_API_KEY: "n",
      OPENROUTER_MODEL: "meta-llama/llama-3.3-70b-instruct:free", PORT: "8080", RATE_LIMIT_MAX: "5",
    });
    expect(cfg.model).toBe("meta-llama/llama-3.3-70b-instruct:free");
    expect(cfg.port).toBe(8080);
    expect(cfg.rateLimitMax).toBe(5);
  });

  it("throws when PORT is not a number", () => {
    expect(() =>
      loadConfig({ OPENROUTER_API_KEY: "a", NEWS_API_KEY: "n", PORT: "abc" })
    ).toThrow(/PORT must be a number/);
  });
});
