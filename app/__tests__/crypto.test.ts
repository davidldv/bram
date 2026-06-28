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
const arr = (u: Uint8Array) => Array.from(u);

describe("crypto key hierarchy", () => {
  it("deriveMasterKey is deterministic and 32 bytes", () => {
    const a = deriveMasterKey("a@b.com", "pw", TINY);
    const b = deriveMasterKey("a@b.com", "pw", TINY);
    expect(a).toHaveLength(32);
    expect(arr(a)).toEqual(arr(b));
  });

  it("deriveMasterKey differs for different email or password", () => {
    const base = deriveMasterKey("a@b.com", "pw", TINY);
    expect(arr(deriveMasterKey("c@b.com", "pw", TINY))).not.toEqual(arr(base));
    expect(arr(deriveMasterKey("a@b.com", "pw2", TINY))).not.toEqual(arr(base));
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
    expect(arr(unwrapKey(wk, blob))).toEqual(arr(key));
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
    expect(arr(unwrapKey(recovery, blob))).toEqual(arr(userKey));
  });

  it("formatRecoveryCode/parseRecoveryCode round-trips and is grouped", () => {
    const raw = bytes(32, 171); // 0xAB
    const code = formatRecoveryCode(raw);
    expect(code).toContain(" "); // grouped for readability
    expect(arr(parseRecoveryCode(code))).toEqual(arr(raw));
    expect(arr(parseRecoveryCode(code.toLowerCase()))).toEqual(arr(raw));
  });

  it("stretchKey is deterministic, 32 bytes, and distinct from the auth secret", () => {
    const mk = deriveMasterKey("a@b.com", "pw", TINY);
    const wk1 = stretchKey(mk);
    expect(wk1).toHaveLength(32);
    expect(arr(stretchKey(mk))).toEqual(arr(wk1));
    expect(formatRecoveryCode(wk1).toLowerCase().replace(/ /g, "")).not.toBe(deriveAuthSecret(mk, "pw"));
  });
});
