import * as SecureStore from "expo-secure-store";

export interface AsyncKV {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

// iOS keychain historically rejects values over ~2048 bytes; a Supabase session
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
