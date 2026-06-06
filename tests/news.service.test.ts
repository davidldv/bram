import { describe, it, expect, vi } from "vitest";
import { createNewsClient } from "../src/services/news";

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("createNewsClient", () => {
  it("maps provider articles to headlines", async () => {
    const fetchFn = vi.fn(async () =>
      fakeResponse({
        articles: [
          { title: "T1", source: { name: "S1" }, url: "http://a" },
          { title: "T2", source: { name: "S2" }, url: "http://b" },
        ],
      })
    );
    const client = createNewsClient({ apiKey: "k", fetchFn: fetchFn as unknown as typeof fetch });

    const headlines = await client.fetchHeadlines(["tech"]);

    expect(headlines).toEqual([
      { title: "T1", source: "S1", url: "http://a" },
      { title: "T2", source: "S2", url: "http://b" },
    ]);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("throws when provider returns non-ok", async () => {
    const fetchFn = vi.fn(async () => fakeResponse({}, false, 500));
    const client = createNewsClient({ apiKey: "k", fetchFn: fetchFn as unknown as typeof fetch });
    await expect(client.fetchHeadlines(["tech"])).rejects.toThrow(/news provider error: 500/);
  });

  it("returns an empty list when the provider omits articles", async () => {
    const fetchFn = vi.fn(async () => fakeResponse({ status: "error" }));
    const client = createNewsClient({ apiKey: "k", fetchFn: fetchFn as unknown as typeof fetch });
    await expect(client.fetchHeadlines(["tech"])).resolves.toEqual([]);
  });
});
