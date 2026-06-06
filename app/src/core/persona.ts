import type { PreferenceRepository } from "./repository";

export const PERSONA_KEY = "persona_name";
export const DEFAULT_PERSONA = "Zayn";

export async function getPersonaName(prefs: PreferenceRepository): Promise<string> {
  const v = await prefs.get(PERSONA_KEY);
  return v ?? DEFAULT_PERSONA;
}

export async function setPersonaName(
  prefs: PreferenceRepository,
  name: string
): Promise<void> {
  await prefs.set(PERSONA_KEY, name.trim() || DEFAULT_PERSONA);
}
