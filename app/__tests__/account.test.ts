import { createAccount, type AuthClient, type SimpleStore } from "../src/auth/account";
import type { KdfParams } from "../src/auth/crypto";

const TINY: KdfParams = { m: 256, t: 1, p: 1, dkLen: 32 };

// Fake Supabase that persists the signUp metadata and returns it on getUser /
// signInWithPassword — enough to prove the wrap/unwrap round-trips end to end.
type StoredUser = { email: string; password: string; user_metadata: Record<string, unknown> };
function fakeClient() {
  let user: StoredUser | null = null;
  let session: StoredUser | null = null;
  const client: AuthClient = {
    auth: {
      async signUp({ email, password, options }) {
        user = { email, password, user_metadata: options?.data ?? {} };
        return { data: { user: { email, user_metadata: user.user_metadata } }, error: null };
      },
      async signInWithPassword({ email, password }) {
        if (!user || user.email !== email || user.password !== password)
          return { data: { user: null }, error: { message: "invalid login" } };
        session = user;
        return { data: { user: { email, user_metadata: user.user_metadata } }, error: null };
      },
      async signOut() {
        session = null;
        return { error: null };
      },
      async getUser() {
        return {
          data: { user: session ? { email: session.email, user_metadata: session.user_metadata } : null },
          error: null,
        };
      },
    },
  };
  return { client, peek: () => user };
}

function memoryStore(): SimpleStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async getItem(k) { return map.get(k) ?? null; },
    async setItem(k, v) { map.set(k, v); },
    async removeItem(k) { map.delete(k); },
  };
}

// Deterministic "randomness" for tests.
const seq = (n: number) => new Uint8Array(n).map((_, i) => (i + 1) & 0xff);
const arr = (u: Uint8Array | null) => (u ? Array.from(u) : null);

describe("account", () => {
  it("signUp sends the derived auth secret (not the password) and stores wrapped keys", async () => {
    const { client, peek } = fakeClient();
    const acct = createAccount({ client, store: memoryStore(), randomBytes: seq, kdf: TINY });
    await acct.signUp("a@b.com", "hunter2");
    const u = peek()!;
    expect(u.password).not.toBe("hunter2"); // never the raw password
    expect(u.password).toMatch(/^[0-9a-f]{64}$/); // hex auth secret
    expect(u.user_metadata.bram_keys).toBeDefined(); // wrapped bundle present
  });

  it("signUp returns a recovery code and caches the user key", async () => {
    const acct = createAccount({ client: fakeClient().client, store: memoryStore(), randomBytes: seq, kdf: TINY });
    const { recoveryCode } = await acct.signUp("a@b.com", "hunter2");
    expect(recoveryCode).toMatch(/[0-9A-F ]+/);
    expect(await acct.getUserKey()).toHaveLength(32);
  });

  it("signIn unwraps the same user key created at signUp", async () => {
    const { client } = fakeClient();
    const store = memoryStore();
    const a = createAccount({ client, store, randomBytes: seq, kdf: TINY });
    await a.signUp("a@b.com", "hunter2");
    const keyAfterSignup = await a.getUserKey();
    await a.signOut();
    expect(await a.getUserKey()).toBeNull();
    await a.signIn("a@b.com", "hunter2");
    expect(arr(await a.getUserKey())).toEqual(arr(keyAfterSignup));
  });

  it("signIn with a wrong password rejects", async () => {
    const { client } = fakeClient();
    const a = createAccount({ client, store: memoryStore(), randomBytes: seq, kdf: TINY });
    await a.signUp("a@b.com", "hunter2");
    await a.signOut();
    await expect(a.signIn("a@b.com", "wrong")).rejects.toThrow();
  });

  it("signOut clears the cached key and getAccount", async () => {
    const { client } = fakeClient();
    const a = createAccount({ client, store: memoryStore(), randomBytes: seq, kdf: TINY });
    await a.signUp("a@b.com", "hunter2");
    await a.signIn("a@b.com", "hunter2");
    expect(await a.getAccount()).toEqual({ email: "a@b.com" });
    await a.signOut();
    expect(await a.getAccount()).toBeNull();
    expect(await a.getUserKey()).toBeNull();
  });
});
