# Account & Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, zero-knowledge email/password account (signup/login/logout) to the Bram app, establishing the encryption-key hierarchy that a later sync engine will use.

**Architecture:** A pure-TS crypto core (`crypto.ts`) derives a master key (Argon2id), splits it into an auth secret sent to Supabase and a local wrap key, and wraps a random data key (also wrapped by a one-time recovery key). An `account.ts` factory orchestrates crypto ↔ Supabase Auth ↔ Keychain/Keystore. The wrapped key bundle lives in Supabase `user_metadata` (no table). UI is a native `<Modal>` auth flow opened from Settings.

**Tech Stack:** Expo SDK 56, React Native 0.85.3, React 19.2.3, TypeScript ~6.0.3, jest-expo. New deps: `@supabase/supabase-js`, `expo-secure-store`, `@noble/hashes`, `@noble/ciphers`, `react-native-url-polyfill`.

## Global Constraints

- **Zero-knowledge invariant:** the server (Supabase) must only ever receive `email`, the derived `authSecret`, and the *wrapped* key blobs + KDF params. `masterKey`, `wrapKey`, `userKey`, `recoveryKey`, and any user plaintext MUST NEVER be sent. Every task preserves this.
- **Tests live in `app/__tests__/*.test.ts(x)`** (jest preset `jest-expo`), NOT co-located. Run from the `app/` directory.
- **Expo SDK v56** — APIs verified against https://docs.expo.dev/versions/v56.0.0/ : `SecureStore.{getItemAsync,setItemAsync,deleteItemAsync}` (Promise-based; iOS value limit ~2048 bytes); `Crypto.getRandomBytes(n)` (sync, returns `Uint8Array`, n ≤ 1024).
- **`crypto.ts` is pure TS** — no `expo-*`/React Native imports, no randomness inside (callers pass nonces/random bytes). This keeps it node-testable and audit-clean.
- **Argon2id params** = OWASP minimum `{ m: 19456 /* KiB */, t: 2, p: 1, dkLen: 32 }` at runtime; tests override with tiny params `{ m: 256, t: 1, p: 1, dkLen: 32 }` for speed.
- **Encoding:** all binary blobs and secrets crossing a boundary are **hex** (via `@noble/hashes/utils`) — no base64 dependency.
- **Commit trailer:** end every commit message with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Branch: `feat/account-signup` (already created; spec already committed).
- ponytail mode active: deliberate shortcuts get a `// ponytail:` comment naming the ceiling + upgrade path. Never simplify away the zero-knowledge invariant.

---

### Task 1: Dependencies + config plumbing

**Files:**
- Modify: `app/package.json` (deps — via pnpm)
- Modify: `app/app.json` (`expo.extra`)
- Modify: `app/src/app/config.ts`

**Interfaces:**
- Produces: `getSupabaseConfig(): { url: string; anonKey: string } | null` (null when unconfigured)

- [ ] **Step 1: Install dependencies**

Run (from `app/`):
```bash
pnpm add @supabase/supabase-js expo-secure-store @noble/hashes @noble/ciphers react-native-url-polyfill
```
Expected: all five appear in `app/package.json` dependencies; `pnpm-lock.yaml` updated. `expo-secure-store` should resolve to a `~56.x` version (Expo-managed).

- [ ] **Step 2: Add Supabase config to app.json**

In `app/app.json`, extend `expo.extra` (keep existing keys):
```json
"extra": {
  "backendBaseUrl": "http://10.0.2.2:3000",
  "clientSecret": "",
  "supabaseUrl": "",
  "supabaseAnonKey": ""
}
```

- [ ] **Step 3: Add the config reader**

Append to `app/src/app/config.ts`:
```ts
// Supabase project URL + anon key (anon key is public/safe to ship). Set both
// in app.json > expo.extra. Returns null when cloud sync isn't configured.
export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const extra = Constants.expoConfig?.extra as
    | { supabaseUrl?: string; supabaseAnonKey?: string }
    | undefined;
  const url = extra?.supabaseUrl?.trim();
  const anonKey = extra?.supabaseAnonKey?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
```

- [ ] **Step 4: Typecheck**

Run (from `app/`): `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/pnpm-lock.yaml app/app.json app/src/app/config.ts
git commit -m "feat(account): add auth/crypto deps and supabase config reader

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(No test: `getSupabaseConfig` is a trivial reader — YAGNI on tests.)

---

### Task 2: Crypto core (pure, zero-knowledge key hierarchy)

**Files:**
- Create: `app/src/auth/crypto.ts`
- Test: `app/__tests__/crypto.test.ts`

**Interfaces:**
- Produces:
  - `interface KdfParams { m: number; t: number; p: number; dkLen: number }`
  - `DEFAULT_KDF: KdfParams` = `{ m: 19456, t: 2, p: 1, dkLen: 32 }`
  - `deriveMasterKey(email: string, password: string, kdf: KdfParams): Uint8Array`
  - `deriveAuthSecret(masterKey: Uint8Array, password: string): string` (hex)
  - `stretchKey(masterKey: Uint8Array): Uint8Array` (32-byte wrap key)
  - `wrapKey(wrappingKey: Uint8Array, key: Uint8Array, nonce: Uint8Array): string` (hex of nonce‖ciphertext)
  - `unwrapKey(wrappingKey: Uint8Array, blob: string): Uint8Array` (throws on wrong key)
  - `formatRecoveryCode(bytes: Uint8Array): string`
  - `parseRecoveryCode(code: string): Uint8Array`

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/crypto.test.ts`:
```ts
import {
  deriveMasterKey,
  deriveAuthSecret,
  stretchKey,
  wrapKey,
  unwrapKey,
  formatRecoveryCode,
  parseRecoveryCode,
  type KdfParams,
} from "../src/auth/crypto";

const TINY: KdfParams = { m: 256, t: 1, p: 1, dkLen: 32 };
const bytes = (n: number, fill: number) => new Uint8Array(n).fill(fill);

describe("crypto key hierarchy", () => {
  it("deriveMasterKey is deterministic and 32 bytes", () => {
    const a = deriveMasterKey("a@b.com", "pw", TINY);
    const b = deriveMasterKey("a@b.com", "pw", TINY);
    expect(a).toHaveLength(32);
    expect(Buffer.from(a)).toEqual(Buffer.from(b));
  });

  it("deriveMasterKey differs for different email or password", () => {
    const base = deriveMasterKey("a@b.com", "pw", TINY);
    expect(Buffer.from(deriveMasterKey("c@b.com", "pw", TINY))).not.toEqual(Buffer.from(base));
    expect(Buffer.from(deriveMasterKey("a@b.com", "pw2", TINY))).not.toEqual(Buffer.from(base));
  });

  it("deriveAuthSecret is deterministic and password-bound", () => {
    const mk = deriveMasterKey("a@b.com", "pw", TINY);
    const s1 = deriveAuthSecret(mk, "pw");
    const s2 = deriveAuthSecret(mk, "pw");
    expect(s1).toBe(s2);
    expect(s1).toMatch(/^[0-9a-f]{64}$/);
    expect(deriveAuthSecret(mk, "other")).not.toBe(s1);
  });

  it("wrapKey/unwrapKey round-trips", () => {
    const wk = bytes(32, 7);
    const key = bytes(32, 9);
    const blob = wrapKey(wk, key, bytes(24, 1));
    expect(Buffer.from(unwrapKey(wk, blob))).toEqual(Buffer.from(key));
  });

  it("unwrapKey throws on the wrong key", () => {
    const key = bytes(32, 9);
    const blob = wrapKey(bytes(32, 7), key, bytes(24, 1));
    expect(() => unwrapKey(bytes(32, 8), blob)).toThrow();
  });

  it("recovery key wraps and unwraps the same data key", () => {
    const userKey = bytes(32, 5);
    const recovery = parseRecoveryCode(formatRecoveryCode(bytes(32, 42)));
    const blob = wrapKey(recovery, userKey, bytes(24, 2));
    expect(Buffer.from(unwrapKey(recovery, blob))).toEqual(Buffer.from(userKey));
  });

  it("formatRecoveryCode/parseRecoveryCode round-trips and is grouped", () => {
    const raw = bytes(32, 171); // 0xAB
    const code = formatRecoveryCode(raw);
    expect(code).toContain(" "); // grouped for readability
    expect(Buffer.from(parseRecoveryCode(code))).toEqual(Buffer.from(raw));
    expect(Buffer.from(parseRecoveryCode(code.toLowerCase()))).toEqual(Buffer.from(raw));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `app/`): `pnpm exec jest __tests__/crypto.test.ts`
Expected: FAIL — `Cannot find module '../src/auth/crypto'`.

- [ ] **Step 3: Implement crypto.ts**

Create `app/src/auth/crypto.ts`:
```ts
// Pure, dependency-injected crypto core. No expo/RN imports, no internal
// randomness (callers pass nonces) so it stays node-testable and audit-clean.
import { argon2id } from "@noble/hashes/argon2";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { utf8ToBytes, bytesToHex, hexToBytes, concatBytes } from "@noble/hashes/utils";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";

export interface KdfParams { m: number; t: number; p: number; dkLen: number }

// OWASP minimum Argon2id. `m` is memory in KiB per @noble/hashes.
export const DEFAULT_KDF: KdfParams = { m: 19456, t: 2, p: 1, dkLen: 32 };

const NONCE_LEN = 24; // XChaCha20-Poly1305

// salt = first 16 bytes of SHA-256(lowercased email). Deterministic so the key
// reproduces on any device with no pre-login salt-fetch endpoint (which would
// also enable email enumeration).
// ponytail: email-derived salt; upgrade to a random per-account salt if needed.
function masterSalt(email: string): Uint8Array {
  return sha256(utf8ToBytes(email.trim().toLowerCase())).slice(0, 16);
}

export function deriveMasterKey(email: string, password: string, kdf: KdfParams): Uint8Array {
  return argon2id(utf8ToBytes(password), masterSalt(email), {
    t: kdf.t, m: kdf.m, p: kdf.p, dkLen: kdf.dkLen,
  });
}

// Sent to Supabase as the account "password". HKDF over the master key salted
// by the password; the server can't reverse it into the master/wrap/user keys.
export function deriveAuthSecret(masterKey: Uint8Array, password: string): string {
  return bytesToHex(
    hkdf(sha256, masterKey, utf8ToBytes(password), utf8ToBytes("bram-auth"), 32)
  );
}

// Stretched master key used to wrap the data key. Never leaves the device.
export function stretchKey(masterKey: Uint8Array): Uint8Array {
  return hkdf(sha256, masterKey, utf8ToBytes("bram"), utf8ToBytes("bram-wrap"), 32);
}

export function wrapKey(wrappingKey: Uint8Array, key: Uint8Array, nonce: Uint8Array): string {
  const ct = xchacha20poly1305(wrappingKey, nonce).encrypt(key);
  return bytesToHex(concatBytes(nonce, ct));
}

export function unwrapKey(wrappingKey: Uint8Array, blob: string): Uint8Array {
  const raw = hexToBytes(blob);
  const nonce = raw.slice(0, NONCE_LEN);
  const ct = raw.slice(NONCE_LEN);
  return xchacha20poly1305(wrappingKey, nonce).decrypt(ct); // throws on bad tag
}

// 32 random bytes shown once as 8 space-separated groups of 8 hex chars.
// Copy is the primary path; grouping aids the rare hand-transcription.
// ponytail: hex code; upgrade to a BIP39 mnemonic if transcribability matters.
export function formatRecoveryCode(bytes: Uint8Array): string {
  const hex = bytesToHex(bytes).toUpperCase();
  return (hex.match(/.{1,8}/g) ?? []).join(" ");
}

export function parseRecoveryCode(code: string): Uint8Array {
  return hexToBytes(code.replace(/[^0-9a-fA-F]/g, "").toLowerCase());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `app/`): `pnpm exec jest __tests__/crypto.test.ts`
Expected: PASS (6 tests). If `@noble/hashes/sha256` fails to resolve, use `@noble/hashes/sha2` and import `{ sha256 }` from there.

- [ ] **Step 5: Commit**

```bash
git add app/src/auth/crypto.ts app/__tests__/crypto.test.ts
git commit -m "feat(account): zero-knowledge crypto key hierarchy

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Chunked secure storage (Keychain/Keystore + size workaround)

**Files:**
- Create: `app/src/auth/secure-storage.ts`
- Test: `app/__tests__/secure-storage.test.ts`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces:
  - `interface AsyncKV { getItemAsync(k: string): Promise<string | null>; setItemAsync(k: string, v: string): Promise<void>; deleteItemAsync(k: string): Promise<void> }`
  - `createChunkedStore(kv: AsyncKV): { getItem(k): Promise<string|null>; setItem(k, v): Promise<void>; removeItem(k): Promise<void> }` — a Supabase-compatible storage adapter that splits values to stay under the iOS ~2048-byte keychain limit.
  - `secureStore: AsyncKV` — the real `expo-secure-store` binding.
  - `chunkedSecureStore` — `createChunkedStore(secureStore)`.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/secure-storage.test.ts`:
```ts
import { createChunkedStore, type AsyncKV } from "../src/auth/secure-storage";

function memoryKV(): AsyncKV & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async getItemAsync(k) { return map.has(k) ? map.get(k)! : null; },
    async setItemAsync(k, v) { map.set(k, v); },
    async deleteItemAsync(k) { map.delete(k); },
  };
}

describe("createChunkedStore", () => {
  it("round-trips a value larger than one chunk", async () => {
    const kv = memoryKV();
    const store = createChunkedStore(kv);
    const big = "x".repeat(5000);
    await store.setItem("sb-token", big);
    expect(await store.getItem("sb-token")).toBe(big);
    // stored as multiple physical entries, none oversized
    expect(kv.map.size).toBeGreaterThan(1);
    for (const v of kv.map.values()) expect(v.length).toBeLessThanOrEqual(2000);
  });

  it("returns null for a missing key", async () => {
    const store = createChunkedStore(memoryKV());
    expect(await store.getItem("nope")).toBeNull();
  });

  it("removeItem deletes all chunks", async () => {
    const kv = memoryKV();
    const store = createChunkedStore(kv);
    await store.setItem("k", "y".repeat(5000));
    await store.removeItem("k");
    expect(kv.map.size).toBe(0);
    expect(await store.getItem("k")).toBeNull();
  });

  it("overwriting a long value with a short one leaves no stale chunks", async () => {
    const kv = memoryKV();
    const store = createChunkedStore(kv);
    await store.setItem("k", "z".repeat(5000));
    await store.setItem("k", "short");
    expect(await store.getItem("k")).toBe("short");
    expect(kv.map.size).toBe(2); // meta + 1 chunk
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `app/`): `pnpm exec jest __tests__/secure-storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement secure-storage.ts**

Create `app/src/auth/secure-storage.ts`:
```ts
import * as SecureStore from "expo-secure-store";

export interface AsyncKV {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

// iOS keychain historically rejects values over ~2048 bytes; Supabase session
// JSON exceeds that. Split into chunks; a meta key holds the chunk count.
// ponytail: fixed 2000-char chunking; fine for tokens, revisit only if a value
// ever needs thousands of chunks.
const CHUNK = 2000;
const metaKey = (k: string) => `${k}__n`;
const partKey = (k: string, i: number) => `${k}__${i}`;

export function createChunkedStore(kv: AsyncKV) {
  async function removeItem(key: string): Promise<void> {
    const n = Number((await kv.getItemAsync(metaKey(key))) ?? 0);
    for (let i = 0; i < n; i++) await kv.deleteItemAsync(partKey(key, i));
    await kv.deleteItemAsync(metaKey(key));
  }
  return {
    async getItem(key: string): Promise<string | null> {
      const meta = await kv.getItemAsync(metaKey(key));
      if (meta === null) return null;
      const n = Number(meta);
      let out = "";
      for (let i = 0; i < n; i++) out += (await kv.getItemAsync(partKey(key, i))) ?? "";
      return out;
    },
    async setItem(key: string, value: string): Promise<void> {
      await removeItem(key); // clear stale chunks first
      const parts = value.match(new RegExp(`.{1,${CHUNK}}`, "gs")) ?? [""];
      for (let i = 0; i < parts.length; i++) await kv.setItemAsync(partKey(key, i), parts[i]);
      await kv.setItemAsync(metaKey(key), String(parts.length));
    },
    removeItem,
  };
}

export const secureStore: AsyncKV = {
  getItemAsync: SecureStore.getItemAsync,
  setItemAsync: SecureStore.setItemAsync,
  deleteItemAsync: SecureStore.deleteItemAsync,
};

export const chunkedSecureStore = createChunkedStore(secureStore);
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `app/`): `pnpm exec jest __tests__/secure-storage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/auth/secure-storage.ts app/__tests__/secure-storage.test.ts
git commit -m "feat(account): chunked SecureStore adapter for session storage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Supabase client wiring

**Files:**
- Create: `app/src/auth/supabase.ts`

**Interfaces:**
- Consumes: `getSupabaseConfig` (Task 1), `chunkedSecureStore` (Task 3).
- Produces: `getSupabase(): SupabaseClient | null` — lazily builds a singleton client; returns null when unconfigured.

- [ ] **Step 1: Implement supabase.ts**

Create `app/src/auth/supabase.ts`:
```ts
import "react-native-url-polyfill/auto"; // Supabase needs a WHATWG URL under Hermes
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "../app/config";
import { chunkedSecureStore } from "./secure-storage";

let client: SupabaseClient | null = null;

// Lazy singleton — null when cloud sync isn't configured (no URL/anon key).
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  client = createClient(cfg.url, cfg.anonKey, {
    auth: {
      storage: chunkedSecureStore, // session/refresh token at rest in Keychain/Keystore
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // no URL-based OAuth in a native app
    },
  });
  return client;
}
```

- [ ] **Step 2: Typecheck**

Run (from `app/`): `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/auth/supabase.ts
git commit -m "feat(account): lazy Supabase client with SecureStore session

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(No unit test: pure wiring exercised through `account.ts`'s fake client in Task 5; runtime verified on a device build.)

---

### Task 5: Account orchestration (signup/login/logout)

**Files:**
- Create: `app/src/auth/account.ts`
- Test: `app/__tests__/account.test.ts`

**Interfaces:**
- Consumes: all of `crypto.ts` (Task 2), `getSupabase` (Task 4), `chunkedSecureStore`/`secureStore` (Task 3), `Crypto.getRandomBytes` (expo-crypto), `DEFAULT_KDF`.
- Produces:
  - `interface KeyBundle { v: 1; kdf: KdfParams; wrap: string; recovery: string }`
  - `interface AuthClient` — the minimal Supabase surface used (so tests can fake it):
    ```ts
    interface AuthResult { data: { user: { email?: string; user_metadata?: Record<string, unknown> } | null }; error: { message: string } | null }
    interface AuthClient {
      auth: {
        signUp(a: { email: string; password: string; options?: { data?: Record<string, unknown> } }): Promise<AuthResult>;
        signInWithPassword(a: { email: string; password: string }): Promise<AuthResult>;
        signOut(): Promise<{ error: { message: string } | null }>;
        getUser(): Promise<AuthResult>;
      };
    }
    ```
  - `interface SimpleStore { getItem(k): Promise<string|null>; setItem(k, v): Promise<void>; removeItem(k): Promise<void> }`
  - `interface AccountDeps { client: AuthClient; store: SimpleStore; randomBytes: (n: number) => Uint8Array; kdf?: KdfParams }`
  - `createAccount(deps: AccountDeps): Account` where
    ```ts
    interface Account {
      signUp(email: string, password: string): Promise<{ recoveryCode: string }>;
      signIn(email: string, password: string): Promise<void>;
      signOut(): Promise<void>;
      getAccount(): Promise<{ email: string } | null>;
      getUserKey(): Promise<Uint8Array | null>;
    }
    ```
  - `account(): Account` — lazily-built default instance over the real Supabase client + SecureStore + expo-crypto. Throws a clear error if Supabase isn't configured.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/account.test.ts`:
```ts
import { createAccount, type AuthClient, type SimpleStore } from "../src/auth/account";
import type { KdfParams } from "../src/auth/crypto";

const TINY: KdfParams = { m: 256, t: 1, p: 1, dkLen: 32 };

// Fake Supabase that persists the signUp metadata and returns it on getUser /
// signInWithPassword — enough to prove the wrap/unwrap round-trips end to end.
function fakeClient() {
  let user: { email: string; password: string; user_metadata: Record<string, unknown> } | null = null;
  let session: typeof user = null;
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
      async signOut() { session = null; return { error: null }; },
      async getUser() {
        return { data: { user: session ? { email: session.email, user_metadata: session.user_metadata } : null }, error: null };
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

describe("account", () => {
  it("signUp sends the derived auth secret (not the password) and stores wrapped keys", async () => {
    const { client, peek } = fakeClient();
    const acct = createAccount({ client, store: memoryStore(), randomBytes: seq, kdf: TINY });
    await acct.signUp("a@b.com", "hunter2");
    const u = peek()!;
    expect(u.password).not.toBe("hunter2");           // never the raw password
    expect(u.password).toMatch(/^[0-9a-f]{64}$/);      // hex auth secret
    expect(u.user_metadata.bram_keys).toBeDefined();   // wrapped bundle present
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
    expect(Buffer.from((await a.getUserKey())!)).toEqual(Buffer.from(keyAfterSignup!));
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `app/`): `pnpm exec jest __tests__/account.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement account.ts**

Create `app/src/auth/account.ts`:
```ts
import { getRandomBytes } from "expo-crypto";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  DEFAULT_KDF,
  deriveAuthSecret,
  deriveMasterKey,
  formatRecoveryCode,
  stretchKey,
  unwrapKey,
  wrapKey,
  type KdfParams,
} from "./crypto";
import { getSupabase } from "./supabase";
import { chunkedSecureStore } from "./secure-storage";

const USER_KEY_SLOT = "bram_user_key"; // cached unwrapped data key (hex) in Keychain/Keystore
const META_FIELD = "bram_keys";        // user_metadata field holding the wrapped bundle

export interface KeyBundle { v: 1; kdf: KdfParams; wrap: string; recovery: string }

interface AuthUser { email?: string; user_metadata?: Record<string, unknown> }
interface AuthResult { data: { user: AuthUser | null }; error: { message: string } | null }
export interface AuthClient {
  auth: {
    signUp(a: { email: string; password: string; options?: { data?: Record<string, unknown> } }): Promise<AuthResult>;
    signInWithPassword(a: { email: string; password: string }): Promise<AuthResult>;
    signOut(): Promise<{ error: { message: string } | null }>;
    getUser(): Promise<AuthResult>;
  };
}
export interface SimpleStore {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
}
export interface AccountDeps {
  client: AuthClient;
  store: SimpleStore;
  randomBytes: (n: number) => Uint8Array;
  kdf?: KdfParams;
}
export interface Account {
  signUp(email: string, password: string): Promise<{ recoveryCode: string }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  getAccount(): Promise<{ email: string } | null>;
  getUserKey(): Promise<Uint8Array | null>;
}

export function createAccount(deps: AccountDeps): Account {
  const kdf = deps.kdf ?? DEFAULT_KDF;
  const cache = (key: Uint8Array) => deps.store.setItem(USER_KEY_SLOT, bytesToHex(key));

  return {
    async signUp(email, password) {
      const masterKey = deriveMasterKey(email, password, kdf);
      const userKey = deps.randomBytes(32);
      const recovery = deps.randomBytes(32);
      const bundle: KeyBundle = {
        v: 1,
        kdf,
        wrap: wrapKey(stretchKey(masterKey), userKey, deps.randomBytes(24)),
        recovery: wrapKey(recovery, userKey, deps.randomBytes(24)),
      };
      const { error } = await deps.client.auth.signUp({
        email,
        password: deriveAuthSecret(masterKey, password),
        options: { data: { [META_FIELD]: bundle } },
      });
      if (error) throw new Error(error.message);
      await cache(userKey); // usable immediately, even before email confirmation
      return { recoveryCode: formatRecoveryCode(recovery) };
    },

    async signIn(email, password) {
      const masterKey = deriveMasterKey(email, password, kdf);
      const { data, error } = await deps.client.auth.signInWithPassword({
        email,
        password: deriveAuthSecret(masterKey, password),
      });
      if (error || !data.user) throw new Error(error?.message ?? "sign-in failed");
      const bundle = data.user.user_metadata?.[META_FIELD] as KeyBundle | undefined;
      if (!bundle) throw new Error("account is missing its key bundle");
      await cache(unwrapKey(stretchKey(masterKey), bundle.wrap));
    },

    async signOut() {
      await deps.client.auth.signOut();
      await deps.store.removeItem(USER_KEY_SLOT);
    },

    async getAccount() {
      const { data } = await deps.client.auth.getUser();
      return data.user?.email ? { email: data.user.email } : null;
    },

    async getUserKey() {
      const hex = await deps.store.getItem(USER_KEY_SLOT);
      return hex ? hexToBytes(hex) : null;
    },
  };
}

let _default: Account | null = null;
// Lazily-built real instance. Throws if Supabase isn't configured.
export function account(): Account {
  if (_default) return _default;
  const client = getSupabase();
  if (!client) throw new Error("Cloud sync is not configured");
  _default = createAccount({
    client: client as unknown as AuthClient,
    store: chunkedSecureStore,
    randomBytes: getRandomBytes,
  });
  return _default;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `app/`): `pnpm exec jest __tests__/account.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/auth/account.ts app/__tests__/account.test.ts
git commit -m "feat(account): signup/login/logout orchestration over Supabase

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Auth flow UI (modal step machine)

**Files:**
- Create: `app/src/auth/AuthFlow.tsx`
- Test: `app/__tests__/AuthFlow.test.tsx`

**Interfaces:**
- Consumes: `Account` + `account()` (Task 5); UI primitives `Screen`, `Card`, `GradientButton`, `Section`, theme.
- Produces: `AuthFlow({ visible, onClose, onSignedIn, account?: Account }): JSX.Element` — a native `<Modal>`; `account` defaults to `account()` and is injectable for tests.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/AuthFlow.test.tsx`:
```tsx
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
    const signIn = jest.fn(async () => { throw new Error("invalid login"); });
    render(<AuthFlow visible onClose={() => {}} onSignedIn={() => {}} account={fakeAccount({ signIn })} />);
    fireEvent.changeText(screen.getByLabelText("email"), "a@b.com");
    fireEvent.changeText(screen.getByLabelText("password"), "x");
    fireEvent.press(screen.getByLabelText("Log in"));
    await waitFor(() => expect(screen.getByText(/invalid login/i)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `app/`): `pnpm exec jest __tests__/AuthFlow.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement AuthFlow.tsx**

Create `app/src/auth/AuthFlow.tsx`:
```tsx
import React, { useState } from "react";
import { Modal, ScrollView, Text, TextInput, View, StyleSheet } from "react-native";
import { Screen } from "../ui/Screen";
import { Card } from "../ui/Card";
import { Section } from "../ui/Section";
import { GradientButton } from "../ui/GradientButton";
import { PressableScale } from "../ui/motion";
import { colors, font, radius, space } from "../ui/theme";
import { account as defaultAccount, type Account } from "./account";

type Step = "login" | "signup" | "recovery" | "confirm";

export function AuthFlow({
  visible,
  onClose,
  onSignedIn,
  account = defaultAccount(),
}: {
  visible: boolean;
  onClose: () => void;
  onSignedIn: () => void;
  account?: Account;
}) {
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  const doSignUp = () =>
    run(async () => {
      const { recoveryCode } = await account.signUp(email.trim(), password);
      setRecoveryCode(recoveryCode);
      setStep("recovery");
    });

  const doSignIn = () =>
    run(async () => {
      await account.signIn(email.trim(), password);
      onSignedIn();
    });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen ambient>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>
            {step === "signup" ? "Create your account" : step === "login" ? "Welcome back" : "Almost there"}
          </Text>

          {(step === "login" || step === "signup") && (
            <Section title={step === "signup" ? "Premium cloud backup" : "Sign in to sync"}>
              <Card>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  accessibilityLabel="email"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel="password"
                  placeholder="Master password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  style={styles.input}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                {step === "login" ? (
                  <>
                    <GradientButton label="Log in" onPress={doSignIn} disabled={busy} accessibilityLabel="Log in" />
                    <PressableScale onPress={() => setStep("signup")} accessibilityLabel="Go to sign up" style={styles.linkBtn}>
                      <Text style={styles.link}>New here? Create an account</Text>
                    </PressableScale>
                  </>
                ) : (
                  <>
                    <Text style={styles.note}>
                      Your data is encrypted on this device first — we can never read it. That also means a lost
                      password can only be recovered with the recovery code on the next screen.
                    </Text>
                    <GradientButton label="Create account" onPress={doSignUp} disabled={busy} accessibilityLabel="Create account" />
                    <PressableScale onPress={() => setStep("login")} accessibilityLabel="Go to log in" style={styles.linkBtn}>
                      <Text style={styles.link}>Already have an account? Log in</Text>
                    </PressableScale>
                  </>
                )}
              </Card>
            </Section>
          )}

          {step === "recovery" && (
            <Section title="Your recovery code">
              <Card>
                <Text style={styles.note}>
                  Save this somewhere safe. It is the only way to recover your encrypted data if you forget your
                  password. We don't store it and can't show it again.
                </Text>
                <Text style={styles.code} accessibilityLabel="recovery code">{recoveryCode}</Text>
                <PressableScale
                  onPress={() => setSaved((v) => !v)}
                  accessibilityLabel="I saved my recovery code"
                  style={styles.ack}
                >
                  <Text style={styles.link}>{saved ? "☑" : "☐"} I've saved my recovery code</Text>
                </PressableScale>
                <GradientButton
                  label="Continue"
                  onPress={() => setStep("confirm")}
                  disabled={!saved}
                  accessibilityLabel="Continue"
                />
              </Card>
            </Section>
          )}

          {step === "confirm" && (
            <Section title="Confirm your email">
              <Card>
                <Text style={styles.note}>
                  Please check your email and confirm your address, then come back and log in.
                </Text>
                <GradientButton label="Back to log in" onPress={() => { setStep("login"); }} accessibilityLabel="Back to log in" />
              </Card>
            </Section>
          )}

          <PressableScale onPress={onClose} accessibilityLabel="Close" style={styles.linkBtn}>
            <Text style={styles.link}>Close</Text>
          </PressableScale>
        </ScrollView>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.xl, paddingBottom: space.xxl },
  title: { color: colors.text, fontSize: font.hero, fontWeight: font.weight.bold, letterSpacing: -1, marginBottom: space.lg },
  input: {
    color: colors.text, fontSize: font.body, backgroundColor: colors.surfaceHi, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: space.md, paddingVertical: space.md, marginBottom: space.md,
  },
  note: { color: colors.muted, fontSize: font.small, lineHeight: 18, marginBottom: space.md },
  error: { color: "#ff6b6b", fontSize: font.small, marginBottom: space.md },
  code: {
    color: colors.text, fontSize: font.body, fontWeight: font.weight.bold, letterSpacing: 1,
    backgroundColor: colors.surfaceHi, borderRadius: radius.card, padding: space.md, marginBottom: space.md,
  },
  ack: { paddingVertical: space.sm, marginBottom: space.md },
  linkBtn: { paddingVertical: space.md, alignItems: "center" },
  link: { color: colors.accent, fontSize: font.body },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `app/`): `pnpm exec jest __tests__/AuthFlow.test.tsx`
Expected: PASS (3 tests). If `font.weight`/`radius.pill`/color names differ, adjust to the actual `../ui/theme` exports (open `app/src/ui/theme.ts`).

- [ ] **Step 5: Commit**

```bash
git add app/src/auth/AuthFlow.tsx app/__tests__/AuthFlow.test.tsx
git commit -m "feat(account): auth flow modal (signup/login/recovery)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Settings integration

**Files:**
- Modify: `app/src/screens/SettingsScreen.tsx`
- Test: `app/__tests__/SettingsAccount.test.tsx`

**Interfaces:**
- Consumes: `AuthFlow` (Task 6), `Account` + `account()` (Task 5).
- Produces: a "Cloud backup & sync" Section in Settings; `SettingsScreen` gains an optional `account?: Account` prop (defaults to `account()`) so the section is testable.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/SettingsAccount.test.tsx`:
```tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `app/`): `pnpm exec jest __tests__/SettingsAccount.test.tsx`
Expected: FAIL — `SettingsScreen` doesn't accept `account` / no "Back up and sync" label.

- [ ] **Step 3: Wire the account section into SettingsScreen**

In `app/src/screens/SettingsScreen.tsx`:

Add imports near the others:
```tsx
import { AuthFlow } from "../auth/AuthFlow";
import { account as defaultAccount, type Account } from "../auth/account";
```

Change the component signature and add state + effect (place alongside existing `useState`s):
```tsx
export function SettingsScreen({ account = safeDefaultAccount() }: { account?: Account } = {}) {
  const s = useServices();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const [topics, setTopics] = useState<NewsTopic[]>([]);
  const [memories, setMemories] = useState<Entity[]>([]);
  const [acct, setAcct] = useState<{ email: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const refreshAccount = () => account.getAccount().then(setAcct).catch(() => setAcct(null));
  useEffect(() => { refreshAccount(); }, []);
```
(Keep the existing `useEffect` that loads name/topics/memories.)

Add a `safeDefaultAccount` helper above the component so an unconfigured Supabase doesn't crash render:
```tsx
// account() throws when Supabase isn't configured; Settings should still render.
function safeDefaultAccount(): Account {
  try { return defaultAccount(); }
  catch {
    return {
      signUp: async () => { throw new Error("Cloud sync is not configured"); },
      signIn: async () => { throw new Error("Cloud sync is not configured"); },
      signOut: async () => {},
      getAccount: async () => null,
      getUserKey: async () => null,
    };
  }
}
```

Add the section to the JSX, after the "What Bram knows" `Section` and before the closing `</ScrollView>`:
```tsx
        <Section title="Cloud backup & sync">
          <Card>
            {acct ? (
              <View style={styles.topicRow}>
                <Text style={styles.factText}>{acct.email}</Text>
                <PressableScale
                  onPress={async () => { await account.signOut(); refreshAccount(); }}
                  accessibilityLabel="Sign out"
                  hitSlop={12}
                  style={styles.forget}
                >
                  <Ionicons name="log-out-outline" size={18} color={colors.muted} />
                </PressableScale>
              </View>
            ) : (
              <>
                <Text style={styles.empty}>
                  Back up your data, end-to-end encrypted, and sync across devices. Premium.
                </Text>
                <View style={{ height: space.md }} />
                <GradientButton
                  label="Back up & sync"
                  onPress={() => setAuthOpen(true)}
                  accessibilityLabel="Back up and sync"
                />
              </>
            )}
          </Card>
        </Section>
```

Render the modal just before the closing `</Screen>` (after `</ScrollView>`):
```tsx
        <AuthFlow
          visible={authOpen}
          onClose={() => setAuthOpen(false)}
          onSignedIn={() => { setAuthOpen(false); refreshAccount(); }}
          account={account}
        />
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `app/`): `pnpm exec jest __tests__/SettingsAccount.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full app suite + typecheck**

Run (from `app/`): `pnpm exec tsc --noEmit && pnpm test`
Expected: typecheck clean; all suites pass (the pre-existing 118 + the new crypto/secure-storage/account/AuthFlow/SettingsAccount tests).

- [ ] **Step 6: Commit**

```bash
git add app/src/screens/SettingsScreen.tsx app/__tests__/SettingsAccount.test.tsx
git commit -m "feat(account): cloud backup & sync entry in Settings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Deferred / manual verification (not in this plan)

- **Sync engine** and **billing** — separate specs.
- **Password reset via recovery code** — recovery code is generated and the recovery-wrapped key is stored; the reset flow ships with sync.
- **On-device runtime checks** (need an EAS/dev build, can't run on CI/desktop):
  - Argon2id latency at `DEFAULT_KDF` on a low-end Android device (fall back to `react-native-quick-crypto` if painful — ceiling noted in `crypto.ts`).
  - Supabase signup → email confirmation → login round-trip with real `supabaseUrl`/`supabaseAnonKey`.
  - `react-native-url-polyfill` actually satisfies `@supabase/supabase-js` under Hermes.
- **Supabase project setup:** enable email/password auth, keep email confirmations ON.

## Self-review

- **Spec coverage:** auth (Tasks 4–7) ✓; key hierarchy (Task 2) ✓; storage device+metadata (Tasks 3, 5) ✓; recovery key generate+display+store (Tasks 5, 6) ✓; opt-in Settings entry (Task 7) ✓; deps + config (Task 1) ✓; testing per module ✓; deferred items recorded ✓.
- **Placeholder scan:** no TBD/TODO; every code step has complete code.
- **Type consistency:** `KdfParams`, `DEFAULT_KDF`, `Account`/`AccountDeps`/`AuthClient`/`SimpleStore`, `KeyBundle`, and `wrapKey(wrappingKey, key, nonce)`/`unwrapKey(wrappingKey, blob)` signatures are used identically across Tasks 2/5/6/7. The `bram_keys` metadata field and `bram_user_key` storage slot names are constant. AuthFlow/Settings both take an injectable `account` prop matching the `Account` interface.
