import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from "jose";
import { createSupabaseVerifier } from "../src/auth";

const SUPABASE_URL = "https://proj.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;

let privateKey: CryptoKey;
let verify: ReturnType<typeof createSupabaseVerifier>;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256");
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  verify = createSupabaseVerifier(SUPABASE_URL, createLocalJWKSet({ keys: [{ ...jwk, alg: "ES256" }] }));
});

function sign(claims: { sub?: string; iss?: string; exp?: string }) {
  let jwt = new SignJWT({}).setProtectedHeader({ alg: "ES256" }).setIssuedAt();
  if (claims.sub) jwt = jwt.setSubject(claims.sub);
  jwt = jwt.setIssuer(claims.iss ?? ISSUER).setExpirationTime(claims.exp ?? "5m");
  return jwt.sign(privateKey);
}

describe("createSupabaseVerifier", () => {
  it("resolves the user id from a valid token", async () => {
    const token = await sign({ sub: "user-123" });
    await expect(verify(token)).resolves.toBe("user-123");
  });

  it("rejects a token from another issuer", async () => {
    const token = await sign({ sub: "user-123", iss: "https://evil.example/auth/v1" });
    await expect(verify(token)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const token = await sign({ sub: "user-123", exp: "-5m" });
    await expect(verify(token)).rejects.toThrow();
  });

  it("rejects a token without a sub claim", async () => {
    const token = await sign({});
    await expect(verify(token)).rejects.toThrow();
  });

  it("rejects garbage", async () => {
    await expect(verify("not.a.jwt")).rejects.toThrow();
  });
});
