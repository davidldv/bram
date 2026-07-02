import type { BackupTable } from "./backup";

// The Supabase fluent builder is hard to type precisely; keep `any` at this
// boundary only. The BackupTable port above it is fully typed.
// ponytail: `any` at the Supabase boundary; everything consuming it is typed.
interface SupabaseClientLike {
  from(table: string): any;
}

export function createSupabaseBackupTable(client: SupabaseClientLike): BackupTable {
  const tbl = () => client.from("backup");
  return {
    async read() {
      const { data, error } = await tbl().select("ciphertext, version, schema_version").maybeSingle();
      if (error) throw new Error(error.message);
      return data
        ? { ciphertext: data.ciphertext, version: data.version, schema_version: data.schema_version }
        : null;
    },
    async insert(row) {
      const { data, error } = await tbl()
        .insert({ ciphertext: row.ciphertext, schema_version: row.schema_version })
        .select("version")
        .single();
      if (error) return error.code === "23505" ? "conflict" : Promise.reject(new Error(error.message));
      return { version: data.version };
    },
    async updateIfVersion(expected, row) {
      const { data, error } = await tbl()
        .update({
          ciphertext: row.ciphertext,
          schema_version: row.schema_version,
          version: expected + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("version", expected)
        .select("version");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return "conflict";
      return { version: data[0].version };
    },
  };
}
