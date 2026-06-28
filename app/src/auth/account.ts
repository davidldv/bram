import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
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

const USER_KEY_SLOT = "bram_user_key"; // cached unwrapped data key (hex) in Keychain/Keystore
const META_FIELD = "bram_keys"; // user_metadata field holding the wrapped bundle

export interface KeyBundle {
  v: 1;
  kdf: KdfParams;
  wrap: string;
  recovery: string;
}

interface AuthUser {
  email?: string;
  user_metadata?: Record<string, unknown>;
}
interface AuthResult {
  data: { user: AuthUser | null };
  error: { message: string } | null;
}

// Minimal slice of the Supabase client we use, so tests can fake it.
export interface AuthClient {
  auth: {
    signUp(a: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown> };
    }): Promise<AuthResult>;
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

// Lazily-built real instance. Supabase/SecureStore/expo-crypto are required
// here (not imported at module top) so unit tests of createAccount don't pull
// the native/ESM client into the jest graph. Throws if Supabase isn't configured.
export function account(): Account {
  if (_default) return _default;
  const { getSupabase } = require("./supabase") as typeof import("./supabase");
  const { chunkedSecureStore } = require("./secure-storage") as typeof import("./secure-storage");
  const { getRandomBytes } = require("expo-crypto") as typeof import("expo-crypto");
  const client = getSupabase();
  if (!client) throw new Error("Cloud sync is not configured");
  _default = createAccount({
    client: client as unknown as AuthClient,
    store: chunkedSecureStore,
    randomBytes: getRandomBytes,
  });
  return _default;
}
