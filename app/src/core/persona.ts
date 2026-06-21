import type { PreferenceRepository } from "./repository";

export const PERSONA_KEY = "persona_name";
export const DEFAULT_PERSONA = "Zayn";

export async function getPersonaName(prefs: PreferenceRepository): Promise<string> {
  const v = await prefs.get(PERSONA_KEY);
  return v?.trim() || DEFAULT_PERSONA;
}

export async function setPersonaName(
  prefs: PreferenceRepository,
  name: string
): Promise<void> {
  await prefs.set(PERSONA_KEY, name.trim() || DEFAULT_PERSONA);
}

export function buildChatSystemPrompt(name: string, recall = ""): string {
  const lines = [
    `You are ${name}, a warm, concise personal voice assistant.`,
    "Replies are spoken aloud, so keep them to 1-3 short sentences.",
    "Use plain text only — no markdown, lists, code, or emoji.",
  ];
  if (recall) lines.push("", recall);
  return lines.join("\n");
}
