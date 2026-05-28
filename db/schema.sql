-- DiaryGPT — Full schema (PostgreSQL + pgvector)
-- Run once:  psql $DATABASE_URL -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT        UNIQUE NOT NULL,
  encryption_key_hash  TEXT        NOT NULL,           -- Argon2 hash of user passphrase
  storage_mode         TEXT        NOT NULL DEFAULT 'local'  CHECK (storage_mode IN ('local', 'cloud')),
  embedding_provider   TEXT        NOT NULL DEFAULT 'ollama' CHECK (embedding_provider IN ('ollama', 'openai', 'bedrock', 'jina', 'gemini')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_encrypted  TEXT        NOT NULL,               -- AES-256 encrypted title
  body_encrypted   TEXT        NOT NULL,               -- AES-256 encrypted body
  content_hash     TEXT        NOT NULL,               -- SHA-256 of plaintext for integrity check
  written_at       TIMESTAMPTZ NOT NULL,               -- date the user says they wrote it
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS entries_user_id_idx    ON entries (user_id);
CREATE INDEX IF NOT EXISTS entries_written_at_idx ON entries (written_at DESC);

-- ---------------------------------------------------------------------------
-- embeddings
-- Vectors are NOT encrypted — cosine similarity cannot operate on ciphertext.
-- Chunk text is encrypted; vectors alone cannot reconstruct the original text.
-- Column uses VECTOR(1536) (OpenAI max). 384-dim local vectors are stored
-- as-is in a 1536-dim column — switch models requires re-embedding all entries.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS embeddings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id             UUID        NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  -- 768d for nomic-embed-text (Ollama default). OpenAI text-embedding-3-small = 1536d.
  -- Switching models requires DROP + ADD COLUMN and full re-embedding.
  embedding            VECTOR(768) NOT NULL,
  model_used           TEXT        NOT NULL,           -- e.g. "all-MiniLM-L6-v2" or "text-embedding-3-small"
  chunk_text_encrypted TEXT        NOT NULL,           -- AES-256 encrypted chunk text
  chunk_index          INTEGER     NOT NULL,           -- position within the entry (0-based)
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS embeddings_entry_id_idx ON embeddings (entry_id);
-- ivfflat index for ANN search (build after bulk load; lists ~ sqrt(row_count))
-- CREATE INDEX embeddings_vector_idx ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- analysis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id              UUID        NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
  mood                  TEXT,                          -- detected mood label
  themes                JSONB,                         -- array of theme strings
  reflection_encrypted  TEXT,                          -- LLM-generated reflection, AES-256 encrypted
  follow_up_question    TEXT,                          -- plain-text prompt for user to reflect further
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analysis_entry_id_idx ON analysis (entry_id);

-- ---------------------------------------------------------------------------
-- chat_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON chat_sessions (user_id);

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role               TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content_encrypted  TEXT        NOT NULL,             -- AES-256 encrypted message content
  context_entry_ids  JSONB,                            -- array of entry UUIDs used as RAG context
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages (session_id);

-- ---------------------------------------------------------------------------
-- therapy_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapy_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'New session',
  flagged    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS therapy_sessions_user_id_idx ON therapy_sessions (user_id);

-- ---------------------------------------------------------------------------
-- therapy_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapy_messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID        NOT NULL REFERENCES therapy_sessions(id) ON DELETE CASCADE,
  role              TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content_encrypted TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS therapy_messages_session_id_idx ON therapy_messages (session_id);

-- ---------------------------------------------------------------------------
-- mood_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mood_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score          INTEGER     NOT NULL CHECK (score >= 1 AND score <= 10),
  note_encrypted TEXT,
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mood_logs_user_id_idx ON mood_logs (user_id);

-- ---------------------------------------------------------------------------
-- app_config  (singleton row — LLM provider + model selection)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT        PRIMARY KEY DEFAULT 'default',
  provider   TEXT        NOT NULL DEFAULT 'anthropic',
  model      TEXT        NOT NULL DEFAULT 'claude-sonnet-4-6',
  api_key    TEXT,                                     -- optional per-provider override
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
