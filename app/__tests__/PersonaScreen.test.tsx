import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { PersonaScreen } from "../src/screens/PersonaScreen";
import { ServicesProvider, type Services } from "../src/app/services";
import { createBramApi } from "../src/core/api";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";
import { getPersonaName } from "../src/core/persona";
import type { PreferenceRepository } from "../src/core/repository";

function servicesWith(prefs: PreferenceRepository): Services {
  return {
    api: createBramApi({ baseUrl: "http://x" }),
    plans: createMemoryPlanRepository(),
    topics: createMemoryTopicRepository([]),
    prefs,
    speaker: { speak: async () => {}, stop: () => {} },
    voice: { start: async () => {}, stop: () => {} },
    newId: () => "x",
    now: () => 0,
  };
}

describe("PersonaScreen", () => {
  it("shows the default name and saves a new one", async () => {
    const prefs = createMemoryPreferenceRepository();
    render(
      <ServicesProvider services={servicesWith(prefs)}>
        <PersonaScreen />
      </ServicesProvider>
    );

    await waitFor(() => expect(screen.getByText("Current: Zayn")).toBeTruthy());

    fireEvent.changeText(screen.getByLabelText("persona name"), "Otto");
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => expect(screen.getByText("Current: Otto")).toBeTruthy());
    expect(await getPersonaName(prefs)).toBe("Otto");
  });
});
