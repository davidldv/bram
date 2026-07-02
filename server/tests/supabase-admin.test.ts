import { describe, it, expect } from "vitest";
import { createSupabaseAdmin } from "../src/services/supabase-admin";

function fakeFetch(status: number) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: init as RequestInit });
    return { ok: status >= 200 && status < 300, status } as Response;
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe("createSupabaseAdmin", () => {
  it("DELETEs the auth admin user endpoint with the service-role key", async () => {
    const { calls, fetchFn } = fakeFetch(200);
    const admin = createSupabaseAdmin({
      supabaseUrl: "https://proj.supabase.co",
      serviceRoleKey: "srk",
      fetchFn,
    });

    await admin.deleteUser("user-123");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://proj.supabase.co/auth/v1/admin/users/user-123");
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].init.headers).toMatchObject({
      Authorization: "Bearer srk",
      apikey: "srk",
    });
  });

  it("throws when the API responds non-ok", async () => {
    const { fetchFn } = fakeFetch(403);
    const admin = createSupabaseAdmin({
      supabaseUrl: "https://proj.supabase.co",
      serviceRoleKey: "srk",
      fetchFn,
    });

    await expect(admin.deleteUser("user-123")).rejects.toThrow(/403/);
  });
});
