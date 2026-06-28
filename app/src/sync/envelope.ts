// Pure AEAD envelope over a JSON value. Same primitive as the key wrapping in
// auth/crypto.ts. noble v2 needs the ".js" subpath.
import { utf8ToBytes, bytesToHex, hexToBytes, concatBytes } from "@noble/hashes/utils.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";

const NONCE_LEN = 24;

export function seal(userKey: Uint8Array, value: unknown, nonce: Uint8Array): string {
  const ct = xchacha20poly1305(userKey, nonce).encrypt(utf8ToBytes(JSON.stringify(value)));
  return bytesToHex(concatBytes(nonce, ct));
}

export function open(userKey: Uint8Array, blob: string): unknown {
  const raw = hexToBytes(blob);
  const pt = xchacha20poly1305(userKey, raw.slice(0, NONCE_LEN)).decrypt(raw.slice(NONCE_LEN));
  return JSON.parse(new TextDecoder().decode(pt));
}
