import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { AuthFlow } from "../src/auth/AuthFlow";
import type { Account } from "../src/auth/account";

function fakeAccount(over: Partial<Account> = {}): Account {
  return {
    signUp: async () => ({ recoveryCode: "AAAA BBBB" }),
    signIn: async () => {},
    signOut: async () => {},
    getAccount: async () => null,
    getUserKey: async () => null,
    ...over,
  };
}

describe("AuthFlow", () => {
  it("signup shows the one-time recovery code and gates continue on acknowledgment", async () => {
    const acct = fakeAccount();
    render(<AuthFlow visible onClose={() => {}} onSignedIn={() => {}} account={acct} />);

    fireEvent.press(screen.getByLabelText("Go to sign up"));
    fireEvent.changeText(screen.getByLabelText("email"), "a@b.com");
    fireEvent.changeText(screen.getByLabelText("password"), "hunter2");
    fireEvent.press(screen.getByLabelText("Create account"));

    await waitFor(() => expect(screen.getByText(/AAAA BBBB/)).toBeTruthy());
    // continue is disabled until the user confirms they saved it
    fireEvent.press(screen.getByLabelText("I saved my recovery code"));
    fireEvent.press(screen.getByLabelText("Continue"));
    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeTruthy());
  });

  it("login calls signIn and onSignedIn", async () => {
    const onSignedIn = jest.fn();
    const signIn = jest.fn(async () => {});
    render(<AuthFlow visible onClose={() => {}} onSignedIn={onSignedIn} account={fakeAccount({ signIn })} />);

    fireEvent.changeText(screen.getByLabelText("email"), "a@b.com");
    fireEvent.changeText(screen.getByLabelText("password"), "hunter2");
    fireEvent.press(screen.getByLabelText("Log in"));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(signIn).toHaveBeenCalledWith("a@b.com", "hunter2");
  });

  it("surfaces an error when sign in fails", async () => {
    const signIn = jest.fn(async () => {
      throw new Error("invalid login");
    });
    render(<AuthFlow visible onClose={() => {}} onSignedIn={() => {}} account={fakeAccount({ signIn })} />);
    fireEvent.changeText(screen.getByLabelText("email"), "a@b.com");
    fireEvent.changeText(screen.getByLabelText("password"), "x");
    fireEvent.press(screen.getByLabelText("Log in"));
    await waitFor(() => expect(screen.getByText(/invalid login/i)).toBeTruthy());
  });
});
