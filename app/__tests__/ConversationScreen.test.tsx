import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ConversationScreen } from "../src/screens/ConversationScreen";
import { ServicesProvider, type Services } from "../src/app/services";
import { createBramApi } from "../src/core/api";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function servicesWithReply(reply: string, transcript: string): { services: Services; spoken: string[] } {
  const spoken: string[] = [];
  const fetchFn = (async () => jsonResponse({ reply })) as unknown as typeof fetch;
  return {
    spoken,
    services: {
      api: createBramApi({ baseUrl: "http://x", fetchFn }),
      plans: createMemoryPlanRepository(),
      topics: createMemoryTopicRepository([]),
      prefs: createMemoryPreferenceRepository(),
      memories: { add: async () => {}, list: async () => [], delete: async () => {} },
      speaker: { speak: async (t: string) => { spoken.push(t); }, stop: () => {} },
      voice: { start: async (onResult: (t: string) => void) => { onResult(transcript); }, stop: () => {} },
      notifier: { schedule: async () => {}, cancel: async () => {} },
      newId: () => "id-1",
      now: () => new Date(2026, 5, 5, 8, 0).getTime(),
    },
  };
}

describe("ConversationScreen", () => {
  it("shows the briefing reply and speaks it after the user talks", async () => {
    const { services, spoken } = servicesWithReply("Good morning, David.", "good morning");
    render(
      <ServicesProvider services={services}>
        <ConversationScreen />
      </ServicesProvider>
    );

    fireEvent.press(screen.getByLabelText("Talk"));

    await waitFor(() => expect(screen.getByText("Good morning, David.")).toBeTruthy());
    expect(spoken).toContain("Good morning, David.");
    expect(screen.getByText("good morning")).toBeTruthy();
  });
});
