import React from "react";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { ServicesProvider, useServices, type Services } from "../src/app/services";
import { createBramApi } from "../src/core/api";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";

function fakeServices(): Services {
  return {
    api: createBramApi({ baseUrl: "http://x", fetchFn: (async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch }),
    plans: createMemoryPlanRepository(),
    topics: createMemoryTopicRepository([]),
    prefs: createMemoryPreferenceRepository(),
    memories: { add: async () => {}, list: async () => [], delete: async () => {} },
    speaker: { speak: async () => {}, stop: () => {} },
    voice: { start: async () => {}, stop: () => {} },
    notifier: { schedule: async () => {}, scheduleAt: async () => {}, cancel: async () => {} },
    calendar: { listEvents: async () => [] },
    newId: () => "x",
    now: () => 0,
  };
}

function Probe() {
  const s = useServices();
  return <Text>{typeof s.newId === "function" ? "has-services" : "no"}</Text>;
}

describe("ServicesProvider", () => {
  it("exposes services to children via useServices", () => {
    render(
      <ServicesProvider services={fakeServices()}>
        <Probe />
      </ServicesProvider>
    );
    expect(screen.getByText("has-services")).toBeTruthy();
  });

  it("throws when used outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ServicesProvider missing/);
    spy.mockRestore();
  });
});
