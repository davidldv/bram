# Account & Signup (Zero-Knowledge Foundation)

**Date:** 2026-06-27
**Status:** Design approved, pending spec review

## Summary

Bram is local-first: everything lives in on-device SQLite, and the proxy
(`server/`) is stateless. This spec adds an **optional** account system so a
user can later back up and sync their data to the cloud (Supabase) as a paid
("Premium") feature — with **zero-knowledge encryption**: data is encrypted on
the device before it leaves, and the server can never decrypt it.

This spec covers only the **account foundation**: signup, login, logout,
session persistence, and the key hierarchy that everything else rests on. The
sync engine and billing are separate, later specs.

## Goals

- Email/password account via Supabase Auth.
- Zero-knowledge key hierarchy: the server stores only ciphertext and an
  authentication secret it cannot reverse into the encryption key.
- A one-time recovery key so a forgotten password doesn't silently mean
  permanent data loss.
- Opt-in: the app keeps working fully offline with no account. Signup is
  reached from Settings, never forced at launch.

## Non-goals (deferred to their own specs)

- **Sync engine** — encrypting/uploading the SQLite life-model as blobs,
  pull/merge, conflict resolution. Out of scope here.
- **Billing** — actually charging for Premium. The Settings entry is labelled
  "Premium" but gates nothing yet; signup is free to exercise.
- **Password reset via recovery key** — we *generate and display* the recovery
  key now and store the recovery-wrapped data key, but the flow that consumes
  it to reset a password ships with sync.

## Key hierarchy (Bitwarden model)

At signup, from `email` + `master password`, all on-device:

```
salt          = SHA-256(lowercase(email))[0:16]
masterKey     = Argon2id(password, salt, m=19456 KiB, t=2, p=1)   // OWASP minimum
authSecret    = HKDF-SHA256(masterKey, info="bram-auth", salt=password)
wrapKey       = HKDF-SHA256(masterKey, info="bram-wrap")
userKey       = random 32 bytes
recoveryKey   = random 32 bytes

wrapped_user_key          = XChaCha20-Poly1305(wrapKey,     userKey)
wrapped_user_key_recovery = XChaCha20-Poly1305(recoveryKey, userKey)
```

Properties:

- The server receives only `email`, `authSecret` (which Supabase bcrypts
  again), the two wrapped blobs, and KDF params. It can never derive
  `masterKey`, `userKey`, or any plaintext.
- `userKey` is the real data-encryption key (random, high-entropy regardless of
  password strength). Changing the password re-wraps `userKey` — no data
  re-encryption.
- Losing both password and recovery key is unrecoverable. This is correct for
  zero-knowledge and is made explicit in the UI.

### Deliberate ceilings (`ponytail:`)

- **Salt = derived from email** (deterministic) avoids a pre-login salt-fetch
  endpoint and email enumeration. Upgrade path: random per-account salt fetched
  before login, if the threat model demands it.
- **Pure-JS Argon2id** (`@noble/hashes`). On-device derivation may take a
  couple of seconds; acceptable for an infrequent login behind a spinner.
  Upgrade path: native `react-native-quick-crypto` if latency hurts.

## Storage

- **Device — `expo-secure-store` (iOS Keychain / Android Keystore):** the
  unwrapped `userKey` (session cache, so Argon2 isn't re-run per operation) and
  the Supabase session/refresh token. A small chunking adapter works around
  Android's ~2KB per-value limit. Token-at-rest lives in the Keystore, not
  AsyncStorage.
- **Supabase — `auth.users.user_metadata`:** the wrapped key bundle
  (`kdf` params, `wrapped_user_key`, `wrapped_user_key_recovery`), written
  during `signUp`. This avoids a separate table, migration, and RLS, and
  sidesteps the email-confirmation/session-ordering problem (metadata is set at
  signup even before the session exists).
  - `ponytail:` user_metadata over a dedicated `user_keys` table — switch to a
    table + RLS if server-side constraints or auditing are later required.

## Modules & interfaces

- **`app/src/auth/crypto.ts`** — pure TS, no React Native imports, fully
  unit-testable:
  - `deriveMasterKey(email, password, kdf)` → `Uint8Array`
  - `deriveAuthSecret(masterKey, password)` → `string` (base64)
  - `stretchKey(masterKey)` → `Uint8Array` (wrapKey)
  - `generateUserKey()` / `generateRecoveryKey()` → `Uint8Array`
  - `formatRecoveryCode(bytes)` / `parseRecoveryCode(code)` — grouped,
    human-transcribable encoding
  - `wrapKey(wrappingKey, key)` / `unwrapKey(wrappingKey, blob)` —
    XChaCha20-Poly1305, blob = base64(nonce ‖ ciphertext); unwrap throws on a
    wrong key (AEAD tag failure)
  - Built on `@noble/hashes` (argon2id, hkdf, sha256) and `@noble/ciphers`
    (xchacha20poly1305). Randomness from `expo-crypto` `getRandomBytes`.
- **`app/src/auth/supabase.ts`** — the configured client. URL + anon key from
  `app.json > expo.extra` (anon key is public/safe), using the SecureStore
  chunking adapter for session persistence.
- **`app/src/auth/account.ts`** — orchestration over crypto ↔ Supabase ↔
  SecureStore:
  - `signUp(email, password)` → derives keys, generates `userKey` +
    `recoveryKey`, wraps both, calls Supabase `signUp` with `authSecret` as the
    password and the wrapped bundle in `options.data`, caches `userKey` in
    SecureStore; returns `{ recoveryKey }`.
  - `signIn(email, password)` → derives `masterKey`/`authSecret`, Supabase
    `signInWithPassword`, reads wrapped bundle from the session user, unwraps
    `userKey`, caches it.
  - `signOut()` → Supabase `signOut`, clears the cached `userKey`.
  - `getAccount()` → current email + signed-in state.

## UI

No navigation library is added; the app's existing manual conditional-render
pattern is preserved.

- **Settings** gains a "Cloud backup & sync" section:
  - Signed out: a "Back up & sync — Premium" button that opens the auth flow.
  - Signed in: the account email and a "Sign out" button.
- **`<AuthFlow>`** is a native RN `<Modal>` launched from Settings, driven by a
  small `useState` step machine:
  `choose (login | signup)`
  → **signup** → **recovery-key screen** (shows the one-time code; "Copy" and a
    required "I've saved it" acknowledgment) → **"check your email"** → done
  → **login** → done
  - Email confirmation stays **ON** (Supabase default). The "check your email"
    state handles the gap before confirmation; signup still caches `userKey`
    locally so the app keeps working immediately.

## Configuration

- `app.json > expo.extra`: `supabaseUrl`, `supabaseAnonKey`.
- `app/src/app/config.ts`: `getSupabaseConfig()` reader alongside the existing
  `getBackendBaseUrl` / `getClientSecret`.
- Supabase project: email/password auth enabled, email confirmations ON.

## Dependencies (new)

`@supabase/supabase-js`, `expo-secure-store`, `@noble/hashes`,
`@noble/ciphers`. Possibly `react-native-url-polyfill` — added only if Supabase
trips on `URL` under Hermes. No AsyncStorage (SecureStore adapter instead).

## Testing

- **`crypto.ts` (security-critical, jest, no native):**
  - `wrapKey` → `unwrapKey` round-trips to the original bytes.
  - `deriveAuthSecret` is deterministic for the same `(email, password)` and
    differs for a different password.
  - The recovery key unwraps the same `userKey` as the wrap key.
  - `unwrapKey` with a wrong key **throws** (AEAD tag failure).
- **`account.ts` against a mocked Supabase client:** `signUp` writes the
  wrapped bundle to metadata and caches `userKey`; `signIn` unwraps and caches;
  `signOut` clears SecureStore.
- **`AuthFlow`** light render tests following existing React Native Testing
  Library patterns (the recovery-key acknowledgment gate; login/signup toggle).

## Open questions / risks

- Supabase email-confirmation timing under a managed Expo build — verify the
  "check your email" → confirm → `signIn` round-trip on a real device build.
- Pure-JS Argon2id latency on low-end Android — measure; fall back to native if
  needed (ceiling noted above).
- `URL`/`crypto` polyfill needs under Hermes for `@supabase/supabase-js` —
  confirm at integration time.
