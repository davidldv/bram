import { seal, open } from "../src/sync/envelope";

const key = (f: number) => new Uint8Array(32).fill(f);
const nonce = new Uint8Array(24).fill(1);

describe("envelope", () => {
  it("seal/open round-trips a JSON value", () => {
    const value = { a: 1, b: ["x", "y"], c: { d: null } };
    expect(open(key(7), seal(key(7), value, nonce))).toEqual(value);
  });

  it("open throws on the wrong key", () => {
    const blob = seal(key(7), { a: 1 }, nonce);
    expect(() => open(key(8), blob)).toThrow();
  });

  it("open throws on a tampered blob", () => {
    const blob = seal(key(7), { a: 1 }, nonce);
    const flipped = blob.slice(0, -1) + (blob.endsWith("0") ? "1" : "0");
    expect(() => open(key(7), flipped)).toThrow();
  });
});
