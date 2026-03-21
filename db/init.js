/**
 * Database initializer.
 *
 * SQLite (local): schema is applied automatically on first adapter connection.
 *   node db/init.js
 *
 * PostgreSQL (cloud): schema.sql must be applied with psql (requires superuser
 * to CREATE EXTENSION). Run:
 *   psql $DATABASE_URL -f db/schema.sql
 *
 * Set STORAGE_MODE=cloud in .env to switch backends.
 */
import dotenv from 'dotenv';
dotenv.config();

const mode = process.env.STORAGE_MODE || 'local';

if (mode === 'cloud') {
  console.log('PostgreSQL mode detected.');
  console.log('Run the following to initialise the schema (requires superuser):');
  console.log('');
  console.log('  psql $DATABASE_URL -f db/schema.sql');
  console.log('');
  console.log('Ensure the pgvector extension is available on your PostgreSQL instance.');
} else {
  // Importing the sqlite adapter triggers getDb() which applies the schema.
  const { query } = await import('./adapters/sqlite.js');
  await query('SELECT 1');

  const dbPath = process.env.SQLITE_PATH || './data/diary.db';
  console.log(`SQLite database initialised at: ${dbPath}`);
  console.log('Schema applied (idempotent — safe to run multiple times).');
}
