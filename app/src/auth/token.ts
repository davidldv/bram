import { getSupabase } from "./supabase";

// Minimal slice of the Supabase client we use, so tests can fake it.
export interface TokenClient {
  auth: {
    getSession(): Promise<{ data: { session: { access_token: string } | null } }>;
    signInAnonymously(): Promise<{
      data: { session: { access_token: string } | null };
      error: { message: string } | null;
    }>;
  };
}

// Access token for the proxy. Signs in anonymously on first use so
// account-less installs still get a per-user identity; supabase-js
// persists the session and refreshes it on later getSession() calls.
export async function getAccessToken(
  client: TokenClient | null = getSupabase()
): Promise<string | null> {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  if (data.session) return data.session.access_token;
  const anon = await client.auth.signInAnonymously();
  if (anon.error || !anon.data.session) return null;
  return anon.data.session.access_token;
}
