import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
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

  it("deletes the account after the alert is confirmed", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const fetchFn = jest.fn(
      async (..._args: Parameters<typeof fetch>) =>
        ({ ok: true, status: 204, json: async () => ({}) }) as unknown as Response
    );
    const svc: Services = {
      ...services(),
      api: createBramApi({
        baseUrl: "http://x",
        getToken: async () => "jwt",
        fetchFn: fetchFn as unknown as typeof fetch,
      }),
    };
    let signedIn = true;
    const signOut = jest.fn(async () => {
      signedIn = false;
    });
    const account = fakeAccount({
      getAccount: async () => (signedIn ? { email: "a@b.com" } : null),
      signOut,
    });

    render(
      <ServicesProvider services={svc}>
        <SettingsScreen account={account} />
      </ServicesProvider>
    );
    fireEvent.press(await screen.findByLabelText("Delete account"));

    const buttons = alertSpy.mock.calls[0][2];
    await act(async () => {
      await buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://x/account");
    expect((init as RequestInit).method).toBe("DELETE");
    expect(signOut).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText("Back up and sync")).toBeTruthy());
  });

  it("does not delete when the alert is cancelled", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const fetchFn = jest.fn(
      async (..._args: Parameters<typeof fetch>) =>
        ({ ok: true, status: 204, json: async () => ({}) }) as unknown as Response
    );
    const svc: Services = {
      ...services(),
      api: createBramApi({ baseUrl: "http://x", fetchFn: fetchFn as unknown as typeof fetch }),
    };
    render(
      <ServicesProvider services={svc}>
        <SettingsScreen account={fakeAccount({ getAccount: async () => ({ email: "a@b.com" }) })} />
      </ServicesProvider>
    );

    fireEvent.press(await screen.findByLabelText("Delete account"));

    expect(alertSpy).toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
