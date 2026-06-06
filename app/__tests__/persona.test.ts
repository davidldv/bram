import { getPersonaName, setPersonaName, DEFAULT_PERSONA } from "../src/core/persona";
import { createMemoryPreferenceRepository } from "../src/core/memory-repository";

describe("persona", () => {
  it("defaults to Zayn when unset", async () => {
    const prefs = createMemoryPreferenceRepository();
    expect(DEFAULT_PERSONA).toBe("Zayn");
    expect(await getPersonaName(prefs)).toBe("Zayn");
  });

  it("returns the stored name", async () => {
    const prefs = createMemoryPreferenceRepository();
    await setPersonaName(prefs, "Bram");
    expect(await getPersonaName(prefs)).toBe("Bram");
  });

  it("trims input and falls back to default when blank", async () => {
    const prefs = createMemoryPreferenceRepository();
    await setPersonaName(prefs, "   ");
    expect(await getPersonaName(prefs)).toBe("Zayn");
    await setPersonaName(prefs, "  Otto  ");
    expect(await getPersonaName(prefs)).toBe("Otto");
  });
});
