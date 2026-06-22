export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS plan (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  scheduled_at INTEGER,
  created_at INTEGER NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS preference (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS news_topic (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS memory (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS entity (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  attributes TEXT,
  last_mentioned_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  occurred_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS link (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id)
);
`;

export const DEFAULT_TOPICS: { id: string; label: string; enabled: number }[] = [
  { id: "tech", label: "tech", enabled: 1 },
  { id: "world", label: "world", enabled: 1 },
  { id: "business", label: "business", enabled: 0 },
  { id: "science", label: "science", enabled: 0 },
  { id: "sports", label: "sports", enabled: 0 },
];
