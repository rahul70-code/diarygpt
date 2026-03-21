/**
 * Storage adapter router.
 *
 * Reads STORAGE_MODE from env:
 *   'local'  (default) → SQLite via better-sqlite3 + sqlite-vec
 *   'cloud'            → PostgreSQL via pg + pgvector
 *
 * All consumers import from here (or from helpers.js which re-exports).
 * Never import directly from the backend adapters.
 */
import dotenv from 'dotenv';
dotenv.config();

const mode = process.env.STORAGE_MODE || 'local';

const adapter =
  mode === 'cloud'
    ? await import('./adapters/postgres.js')
    : await import('./adapters/sqlite.js');

export const {
  query,
  getOne,
  getMany,
  insert,
  update,
  upsert,
  remove,
  insertEmbedding,
  vectorSearch,
} = adapter;
