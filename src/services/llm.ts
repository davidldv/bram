export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmClient {
  chat(system: string, messages: ChatMessage[], maxTokens: number): Promise<string>;
}
