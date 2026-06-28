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
