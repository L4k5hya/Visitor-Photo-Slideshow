const Database = require('better-sqlite3');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS visitors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS photos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id    INTEGER NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL UNIQUE,
  original_name TEXT,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  consent_at    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'approved'
                CHECK (status IN ('approved', 'removed')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_visitor ON photos(visitor_id);
`;

function openDb(path = process.env.DB_PATH || './data.db') {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb };