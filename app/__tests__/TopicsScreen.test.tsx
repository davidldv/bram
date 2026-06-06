import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { TopicsScreen } from "../src/screens/TopicsScreen";
import { ServicesProvider, type Services } from "../src/app/services";
import { createBramApi } from "../src/core/api";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";
import type { TopicRepository } from "../src/core/repository";

function servicesWith(topics: TopicRepository): Services {
  return {
    api: createBramApi({ baseUrl: "http://x" }),
    plans: createMemoryPlanRepository(),
    topics,
    prefs: createMemoryPreferenceRepository(),
    speaker: { speak: async () => {}, stop: () => {} },
    voice: { start: async () => {}, stop: () => {} },
    newId: () => "x",
    now: () => 0,
  };
}

describe("TopicsScreen", () => {
  it("lists topics and toggles enabled state", async () => {
    const topics = createMemoryTopicRepository([
      { id: "tech", label: "tech", enabled: true },
      { id: "world", label: "world", enabled: false },
    ]);
    render(
      <ServicesProvider services={servicesWith(topics)}>
        <TopicsScreen />
      </ServicesProvider>
    );

    await waitFor(() => expect(screen.getByText("world")).toBeTruthy());

    fireEvent(screen.getByLabelText("toggle world"), "valueChange", true);

    await waitFor(async () => {
      const list = await topics.list();
      expect(list.find((t) => t.id === "world")?.enabled).toBe(true);
    });
  });
});
