import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { TokenVerifier } from "./server";

// Verifies Supabase-issued JWTs locally against the project's JWKS —
// no network round-trip per request (jose caches the key set).
export function createSupabaseVerifier(
  supabaseUrl: string,
  getKey?: JWTVerifyGetKey
): TokenVerifier {
  const jwks =
    getKey ?? createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  const issuer = `${supabaseUrl}/auth/v1`;
  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    if (!payload.sub) throw new Error("token has no sub claim");
    return payload.sub;
  };
}
