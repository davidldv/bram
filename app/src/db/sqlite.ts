// Minimal subset of the expo-sqlite database API that our repositories use.
// The object returned by SQLite.openDatabaseAsync satisfies this structurally.
export interface SqliteDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: (string | number | null)[]): Promise<T[]>;
}
