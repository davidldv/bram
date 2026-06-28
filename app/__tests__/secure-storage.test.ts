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
