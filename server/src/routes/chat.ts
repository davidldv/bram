import { Router } from "express";
import type { LlmClient, ChatMessage } from "../services/llm";

export function chatRouter(llm: LlmClient, maxTokens: number): Router {
  const r = Router();
  r.post("/chat", async (req, res) => {
    const { system, messages } = req.body ?? {};
    if (typeof system !== "string" || !Array.isArray(messages)) {
      return res.status(400).json({ error: "invalid_request" });
    }
    try {
      const reply = await llm.chat(system, messages as ChatMessage[], maxTokens);
      res.json({ reply });
    } catch {
      res.status(502).json({ error: "llm_unavailable" });
    }
  });
  return r;
}
