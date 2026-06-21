export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmClient {
  chat(system: string, messages: ChatMessage[], maxTokens: number): Promise<string>;
}

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Statuses where another key might succeed: 401 bad key, 402 out of credit,
// 429 rate limit, 5xx upstream. Other 4xx are request bugs — fail fast.
function shouldFailover(status: number): boolean {
  return status === 401 || status === 402 || status === 429 || status >= 500;
}

export function createLlmClient(opts: {
  apiKeys: string[];
  model: string;
  fetchFn?: typeof fetch;
  endpoint?: string;
}): LlmClient {
  const fetchFn = opts.fetchFn ?? fetch;
  const endpoint = opts.endpoint ?? OPENROUTER_ENDPOINT;
  const keys = opts.apiKeys.filter((k) => k && k.trim() !== "");
  if (keys.length === 0) throw new Error("at least one OpenRouter API key is required");

  return {
    async chat(system, messages, maxTokens) {
      // OpenAI-compatible: system is a message, not a separate field.
      const body = JSON.stringify({
        model: opts.model,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      });

      let lastErr: Error = new Error("all OpenRouter keys failed");
      for (const key of keys) {
        let res: Response;
        try {
          res = await fetchFn(endpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body,
          });
        } catch (err) {
          lastErr = err as Error; // network error — try next key
          continue;
        }
        if (!res.ok) {
          lastErr = new Error(`OpenRouter ${res.status}`);
          if (shouldFailover(res.status)) continue;
          throw lastErr;
        }
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        return data.choices?.[0]?.message?.content ?? "";
      }
      throw lastErr;
    },
  };
}
