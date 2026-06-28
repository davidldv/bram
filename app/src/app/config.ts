import Constants from "expo-constants";

export function getBackendBaseUrl(): string {
  // Override via app.json > expo.extra.backendBaseUrl. NOTE: the localhost
  // fallback only reaches the backend from an iOS simulator; on a physical
  // device set this to your dev machine's LAN IP (or a deployed URL).
  const extra = Constants.expoConfig?.extra as { backendBaseUrl?: string } | undefined;
  return extra?.backendBaseUrl ?? "http://localhost:3000";
}

// Shared secret sent as x-bram-key; must match the proxy's CLIENT_SECRET.
// Empty/unset in dev when the proxy runs without a secret.
export function getClientSecret(): string | undefined {
  const extra = Constants.expoConfig?.extra as { clientSecret?: string } | undefined;
  return extra?.clientSecret?.trim() || undefined;
}

// Supabase project URL + anon key (anon key is public/safe to ship). Set both
// in app.json > expo.extra. Returns null when cloud sync isn't configured.
export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const extra = Constants.expoConfig?.extra as
    | { supabaseUrl?: string; supabaseAnonKey?: string }
    | undefined;
  const url = extra?.supabaseUrl?.trim();
  const anonKey = extra?.supabaseAnonKey?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
