import * as SecureStore from "expo-secure-store";
import type { MetaStore } from "./backup";

const SLOT = "bram_sync_meta"; // kept out of the synced tables so Restore can't clobber it
const EMPTY = { lastSyncedVersion: null as number | null, lastBackupAt: null as number | null };

export function createSecureMetaStore(): MetaStore {
  return {
    async get() {
      const raw = await SecureStore.getItemAsync(SLOT);
      if (!raw) return { ...EMPTY };
      try {
        return JSON.parse(raw);
      } catch {
        return { ...EMPTY };
      }
    },
    async set(meta) {
      await SecureStore.setItemAsync(SLOT, JSON.stringify(meta));
    },
  };
}
