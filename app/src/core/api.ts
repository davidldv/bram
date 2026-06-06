import type { ChatMessage, Headline } from "./types";

export interface BramApi {
  chat(system: string, messages: ChatMessage[]): Promise<string>;
  news(topics: string[]): Promise<Headline[]>;
}

export function createBramApi(opts: {
  baseUrl: string;
  fetchFn?: typeof fetch;
}): BramApi {
  const fetchFn = opts.fetchFn ?? fetch;
  const base = opts.baseUrl.replace(/\/$/, "");
  const postJson = async (path: string, payload: unknown): Promise<Response> =>
    fetchFn(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  return {
    async chat(system, messages) {
      const res = await postJson("/chat", { system, messages });
      if (!res.ok) throw new Error(`chat failed: ${res.status}`);
      const data = (await res.json()) as { reply: string };
      return data.reply;
    },
    async news(topics) {
      const res = await postJson("/news", { topics });
      if (!res.ok) throw new Error(`news failed: ${res.status}`);
      const data = (await res.json()) as { headlines: Headline[] };
      return data.headlines;
    },
  };
}
