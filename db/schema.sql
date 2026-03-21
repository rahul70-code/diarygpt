-- Run once to initialise the database schema.
-- psql $DATABASE_URL -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Diary entries ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS entries (
  id          TEXT        PRIMARY KEY,          -- UUID supplied by the app
  title       TEXT        NOT NULL DEFAULT 'Untitled',
  body        TEXT        NOT NULL,
  analysis    JSONB,                            -- AI-generated { mood, themes, reflection, followUpQuestion }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS entries_created_at_idx ON entries (created_at DESC);

-- Active provider configuration (singleton row) --------------------------
CREATE TABLE IF NOT EXISTS app_config (
  key         TEXT        PRIMARY KEY DEFAULT 'default',
  provider    TEXT        NOT NULL,
  model       TEXT        NOT NULL,
  api_key     TEXT,                             -- optional per-provider override
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
