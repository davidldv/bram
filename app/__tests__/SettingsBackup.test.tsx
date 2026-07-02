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
import type { Backup } from "../src/sync/backup";

function services(): Services {
  return {
    api: createBramApi({ baseUrl: "http://x", fetchFn: (async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch }),
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

const signedIn: Account = {
  signUp: async () => ({ recoveryCode: "" }),
  signIn: async () => {},
  signOut: async () => {},
  getAccount: async () => ({ email: "a@b.com" }),
  getUserKey: async () => null,
};

function fakeBackup(over: Partial<Backup> = {}): Backup {
  return {
    backupNow: async () => ({ ok: true, version: 1 }),
    restoreNow: async () => ({ ok: true }),
    getStatus: async () => ({ lastBackupAt: null }),
    ...over,
  };
}

const renderWith = (backup: Backup) =>
  render(
    <ServicesProvider services={services()}>
      <SettingsScreen account={signedIn} backup={backup} />
    </ServicesProvider>
  );

describe("Settings backup controls", () => {
  it("shows Back up now when signed in", async () => {
    renderWith(fakeBackup());
    await waitFor(() => expect(screen.getByLabelText("Back up now")).toBeTruthy());
  });

  it("calls backupNow and shows success", async () => {
    const backupNow = jest.fn(async () => ({ ok: true as const, version: 2 }));
    renderWith(fakeBackup({ backupNow }));
    fireEvent.press(await screen.findByLabelText("Back up now"));
    await waitFor(() => expect(backupNow).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Backed up ✓")).toBeTruthy());
  });

  it("offers Overwrite on conflict and forces past it", async () => {
    const backupNow = jest
      .fn()
      .mockResolvedValueOnce({ conflict: true })
      .mockResolvedValueOnce({ ok: true, version: 5 });
    renderWith(fakeBackup({ backupNow }));
    fireEvent.press(await screen.findByLabelText("Back up now"));
    fireEvent.press(await screen.findByLabelText("Overwrite"));
    await waitFor(() => expect(backupNow).toHaveBeenLastCalledWith({ force: true }));
  });

  it("restore confirms then calls restoreNow", async () => {
    const restoreNow = jest.fn(async () => ({ ok: true as const }));
    renderWith(fakeBackup({ restoreNow }));
    fireEvent.press(await screen.findByLabelText("Restore"));
    fireEvent.press(await screen.findByLabelText("Confirm restore"));
    await waitFor(() => expect(restoreNow).toHaveBeenCalled());
  });

  it("Restore first from conflict leads to confirm then restoreNow", async () => {
    const restoreNow = jest.fn(async () => ({ ok: true as const }));
    const backupNow = jest.fn().mockResolvedValueOnce({ conflict: true });
    renderWith(fakeBackup({ backupNow, restoreNow }));
    fireEvent.press(await screen.findByLabelText("Back up now"));
    fireEvent.press(await screen.findByLabelText("Restore first"));
    fireEvent.press(await screen.findByLabelText("Confirm restore"));
    await waitFor(() => expect(restoreNow).toHaveBeenCalled());
  });
});
