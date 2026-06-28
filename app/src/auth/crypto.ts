// Pure, dependency-injected crypto core. No expo/RN imports, no internal
// randomness (callers pass nonces) so it stays node-testable and audit-clean.
// noble v2 export map requires the ".js" suffix on subpath imports.
import { argon2id } from "@noble/hashes/argon2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes, bytesToHex, hexToBytes, concatBytes } from "@noble/hashes/utils.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";

export interface KdfParams {
  m: number;
  t: number;
  p: number;
  dkLen: number;
}

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
    t: kdf.t,
    m: kdf.m,
    p: kdf.p,
    dkLen: kdf.dkLen,
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

// 32 random bytes shown once as space-separated groups of 8 hex chars. Copy is
// the primary path; grouping aids the rare hand-transcription.
// ponytail: hex code; upgrade to a BIP39 mnemonic if transcribability matters.
export function formatRecoveryCode(bytes: Uint8Array): string {
  const hex = bytesToHex(bytes).toUpperCase();
  return (hex.match(/.{1,8}/g) ?? []).join(" ");
}

export function parseRecoveryCode(code: string): Uint8Array {
  return hexToBytes(code.replace(/[^0-9a-fA-F]/g, "").toLowerCase());
}
