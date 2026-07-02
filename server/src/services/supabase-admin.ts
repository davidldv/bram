export interface AccountAdmin {
  deleteUser(userId: string): Promise<void>;
}

// Deletes the auth user via the Supabase admin API (service-role key).
// The backup row goes with it — user_id references auth.users on delete cascade.
export function createSupabaseAdmin(opts: {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchFn?: typeof fetch;
}): AccountAdmin {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    async deleteUser(userId) {
      const res = await fetchFn(
        `${opts.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${opts.serviceRoleKey}`,
            apikey: opts.serviceRoleKey,
          },
        }
      );
      if (!res.ok) throw new Error(`supabase admin delete ${res.status}`);
    },
  };
}
