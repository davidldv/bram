import { getAccessToken, type TokenClient } from "../src/auth/token";

function fakeClient(opts: {
  session?: { access_token: string } | null;
  anonSession?: { access_token: string } | null;
  anonError?: { message: string } | null;
}): TokenClient & { anonCalls: number } {
  const client = {
    anonCalls: 0,
    auth: {
      getSession: async () => ({ data: { session: opts.session ?? null } }),
      signInAnonymously: async () => {
        client.anonCalls++;
        return { data: { session: opts.anonSession ?? null }, error: opts.anonError ?? null };
      },
    },
  };
  return client;
}

describe("getAccessToken", () => {
  it("returns the current session token without signing in again", async () => {
    const client = fakeClient({ session: { access_token: "existing" } });
    await expect(getAccessToken(client)).resolves.toBe("existing");
    expect(client.anonCalls).toBe(0);
  });

  it("signs in anonymously when there is no session", async () => {
    const client = fakeClient({ session: null, anonSession: { access_token: "anon-jwt" } });
    await expect(getAccessToken(client)).resolves.toBe("anon-jwt");
    expect(client.anonCalls).toBe(1);
  });

  it("returns null when anonymous sign-in fails", async () => {
    const client = fakeClient({ session: null, anonError: { message: "disabled" } });
    await expect(getAccessToken(client)).resolves.toBeNull();
  });

  it("returns null when supabase is not configured", async () => {
    await expect(getAccessToken(null)).resolves.toBeNull();
  });
});
