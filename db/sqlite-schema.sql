-- DiaryGPT — SQLite schema (local mode, applied automatically on first connection)
-- Uses TEXT for UUIDs/timestamps/JSON; BLOB for vectors (sqlite-vec float32 binary format).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   TEXT PRIMARY KEY,
  email                TEXT UNIQUE NOT NULL,
  encryption_key_hash  TEXT NOT NULL,
  storage_mode         TEXT NOT NULL DEFAULT 'local'  CHECK (storage_mode IN ('local', 'cloud')),
  embedding_provider   TEXT NOT NULL DEFAULT 'ollama' CHECK (embedding_provider IN ('ollama', 'openai', 'bedrock')),
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entries (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_encrypted  TEXT NOT NULL,
  body_encrypted   TEXT NOT NULL,
  content_hash     TEXT NOT NULL,
  written_at       TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT
);

CREATE INDEX IF NOT EXISTS entries_user_id_idx    ON entries (user_id);
CREATE INDEX IF NOT EXISTS entries_written_at_idx ON entries (written_at DESC);

-- ---------------------------------------------------------------------------
-- embeddings
-- embedding_blob: raw little-endian float32 bytes understood by sqlite-vec's
-- vec_distance_cosine(). Full scan is fine for single-user diary datasets.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS embeddings (
  id                   TEXT PRIMARY KEY,
  entry_id             TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  embedding_blob       BLOB NOT NULL,
  model_used           TEXT NOT NULL,
  chunk_text_encrypted TEXT NOT NULL,
  chunk_index          INTEGER NOT NULL,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS embeddings_entry_id_idx ON embeddings (entry_id);

-- ---------------------------------------------------------------------------
-- analysis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis (
  id                    TEXT PRIMARY KEY,
  entry_id              TEXT NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
  mood                  TEXT,
  themes                TEXT,     -- JSON array stored as TEXT
  reflection_encrypted  TEXT,
  follow_up_question    TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- chat_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New conversation',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON chat_sessions (user_id);

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role               TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content_encrypted  TEXT NOT NULL,
  context_entry_ids  TEXT,     -- JSON array stored as TEXT
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages (session_id);

-- ---------------------------------------------------------------------------
-- app_config (singleton row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY DEFAULT 'default',
  provider   TEXT NOT NULL DEFAULT 'anthropic',
  model      TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  api_key    TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
