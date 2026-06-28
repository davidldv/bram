import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { SettingsScreen } from "../src/screens/SettingsScreen";
import { ServicesProvider, type Services } from "../src/app/services";
import { createBramApi } from "../src/core/api";
import {
  createMemoryPlanRepository,
  createMemoryPreferenceRepository,
  createMemoryTopicRepository,
} from "../src/core/memory-repository";
import { createInMemoryLifeStore } from "../src/core/life-store-memory";
import type { Account } from "../src/auth/account";

function services(): Services {
  return {
    api: createBramApi({
      baseUrl: "http://x",
      fetchFn: (async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch,
    }),
    plans: createMemoryPlanRepository(),
    topics: createMemoryTopicRepository([]),
    prefs: createMemoryPreferenceRepository(),
    store: createInMemoryLifeStore(),
    speaker: { speak: async () => {}, stop: () => {} },
    voice: { start: async () => {}, stop: () => {} },
    notifier: { schedule: async () => {}, scheduleAt: async () => {}, cancel: async () => {} },
    calendar: { listEvents: async () => [] },
    newId: () => "id-1",
    now: () => Date.now(),
  };
}

function fakeAccount(over: Partial<Account> = {}): Account {
  return {
    signUp: async () => ({ recoveryCode: "AAAA" }),
    signIn: async () => {},
    signOut: async () => {},
    getAccount: async () => null,
    getUserKey: async () => null,
    ...over,
  };
}

const renderWith = (account: Account) =>
  render(
    <ServicesProvider services={services()}>
      <SettingsScreen account={account} />
    </ServicesProvider>
  );

describe("Settings cloud backup", () => {
  it("shows the Premium back-up entry when signed out", async () => {
    renderWith(fakeAccount({ getAccount: async () => null }));
    await waitFor(() => expect(screen.getByLabelText("Back up and sync")).toBeTruthy());
  });

  it("shows the email and sign-out when signed in", async () => {
    renderWith(fakeAccount({ getAccount: async () => ({ email: "a@b.com" }) }));
    await waitFor(() => expect(screen.getByText("a@b.com")).toBeTruthy());
    expect(screen.getByLabelText("Sign out")).toBeTruthy();
  });

  it("opens the auth flow when the back-up entry is pressed", async () => {
    renderWith(fakeAccount({ getAccount: async () => null }));
    fireEvent.press(await screen.findByLabelText("Back up and sync"));
    await waitFor(() => expect(screen.getByLabelText("email")).toBeTruthy());
  });
});
