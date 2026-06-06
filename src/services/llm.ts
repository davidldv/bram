import Anthropic from "@anthropic-ai/sdk";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmClient {
  chat(system: string, messages: ChatMessage[], maxTokens: number): Promise<string>;
}

export function createLlmClient(opts: {
  apiKey: string;
  model: string;
  anthropic?: Anthropic;
}): LlmClient {
  const client = opts.anthropic ?? new Anthropic({ apiKey: opts.apiKey });
  return {
    async chat(system, messages, maxTokens) {
      const res = await client.messages.create({
        model: opts.model,
        max_tokens: maxTokens,
        system,
        messages,
      });
      return res.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");
    },
  };
}
