import Constants from "expo-constants";

export function getBackendBaseUrl(): string {
  // Override via app.json > expo.extra.backendBaseUrl. NOTE: the localhost
  // fallback only reaches the backend from an iOS simulator; on a physical
  // device set this to your dev machine's LAN IP (or a deployed URL).
  const extra = Constants.expoConfig?.extra as { backendBaseUrl?: string } | undefined;
  return extra?.backendBaseUrl ?? "http://localhost:3000";
}
