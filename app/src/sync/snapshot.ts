export const SCHEMA_VERSION = 1;

// Whitelisted tables. No foreign keys, so insert order doesn't matter.
export const TABLES = ["entity", "event", "link", "plan", "preference", "news_topic", "memory"] as const;
export type TableName = (typeof TABLES)[number];
export type Row = Record<string, string | number | null>;

export interface Snapshot {
  schemaVersion: number;
  tables: Record<TableName, Row[]>;
}

export interface SnapshotDb {
  all(table: TableName): Promise<Row[]>;
  replaceAll(tables: Record<TableName, Row[]>): Promise<void>; // one transaction in the concrete impl
}

export async function serialize(db: SnapshotDb): Promise<Snapshot> {
  const tables = {} as Record<TableName, Row[]>;
  for (const t of TABLES) tables[t] = await db.all(t);
  return { schemaVersion: SCHEMA_VERSION, tables };
}

export async function restore(db: SnapshotDb, snap: Snapshot): Promise<void> {
  // replaceAll DELETEs every table before refilling it, so a structurally-valid
  // snapshot missing a table key would silently wipe that table without throwing
  // (the transaction wouldn't roll back). serialize() is total over TABLES, so
  // this only trips on a corrupt/forged snapshot — cheap guard on a delete-all path.
  for (const t of TABLES) {
    if (!Array.isArray(snap.tables?.[t])) throw new Error(`Snapshot missing rows for table "${t}"`);
  }
  await db.replaceAll(snap.tables);
}

// Column names come from a snapshot decrypted with the user's own key (AEAD
// rejects tampering), and tables are whitelisted — so dynamic SQL here is safe.
export function buildInsert(table: TableName, row: Row): { sql: string; params: (string | number | null)[] } {
  const cols = Object.keys(row);
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  return { sql, params: cols.map((c) => row[c]) };
}
