import Constants from "expo-constants";

export function getBackendBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { backendBaseUrl?: string } | undefined;
  return extra?.backendBaseUrl ?? "http://localhost:3000";
}
