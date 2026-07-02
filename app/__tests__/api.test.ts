import { createBramApi } from "../src/core/api";

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("createBramApi", () => {
  it("POSTs /chat and returns the reply", async () => {
    const fetchFn = jest.fn(async (..._args: Parameters<typeof fetch>) => fakeResponse({ reply: "hi there" }));
    const api = createBramApi({ baseUrl: "http://host/", fetchFn: fetchFn as unknown as typeof fetch });

    const reply = await api.chat("be brief", [{ role: "user", content: "hi" }]);

    expect(reply).toBe("hi there");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://host/chat");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      system: "be brief",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("POSTs /news and returns headlines", async () => {
    const headlines = [{ title: "T", source: "S", url: "http://a" }];
    const fetchFn = jest.fn(async (..._args: Parameters<typeof fetch>) => fakeResponse({ headlines }));
    const api = createBramApi({ baseUrl: "http://host", fetchFn: fetchFn as unknown as typeof fetch });

    const result = await api.news(["tech"]);

    expect(result).toEqual(headlines);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://host/news");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ topics: ["tech"] });
  });

  it("sends the access token as a Bearer Authorization header", async () => {
    const fetchFn = jest.fn(async (..._args: Parameters<typeof fetch>) => fakeResponse({ reply: "ok" }));
    const api = createBramApi({
      baseUrl: "http://host",
      getToken: async () => "jwt-abc",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await api.chat("s", [{ role: "user", content: "hi" }]);

    const [, init] = fetchFn.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer jwt-abc" });
  });

  it("omits the Authorization header when no token is available", async () => {
    const fetchFn = jest.fn(async (..._args: Parameters<typeof fetch>) => fakeResponse({ reply: "ok" }));
    const api = createBramApi({
      baseUrl: "http://host",
      getToken: async () => null,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await api.chat("s", [{ role: "user", content: "hi" }]);

    const [, init] = fetchFn.mock.calls[0];
    expect((init as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  it("throws when chat returns non-ok", async () => {
    const fetchFn = jest.fn(async (..._args: Parameters<typeof fetch>) => fakeResponse({}, false, 502));
    const api = createBramApi({ baseUrl: "http://host", fetchFn: fetchFn as unknown as typeof fetch });
    await expect(api.chat("s", [])).rejects.toThrow(/chat failed: 502/);
  });

  it("throws when news returns non-ok", async () => {
    const fetchFn = jest.fn(async (..._args: Parameters<typeof fetch>) => fakeResponse({}, false, 503));
    const api = createBramApi({ baseUrl: "http://host", fetchFn: fetchFn as unknown as typeof fetch });
    await expect(api.news(["tech"])).rejects.toThrow(/news failed: 503/);
  });
});
