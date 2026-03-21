/**
 * Re-exports the active storage adapter's CRUD helpers.
 * Models import from here; the adapter module picks SQLite or PostgreSQL
 * based on the STORAGE_MODE environment variable.
 */
export { query, getOne, getMany, insert, update, upsert, remove } from './adapter.js';
