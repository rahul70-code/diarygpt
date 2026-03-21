import { createRequire } from 'module';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// better-sqlite3 is CommonJS — use createRequire for ESM compat
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _db = null;

function getDb() {
  if (_db) return _db;

  const dbPath =
    process.env.SQLITE_PATH ||
    path.join(__dirname, '../../data/diary.db');

  _db = new Database(dbPath);

  // Load sqlite-vec extension for vec_distance_cosine()
  try {
    const sqliteVec = require('sqlite-vec');
    sqliteVec.load(_db);
  } catch (err) {
    console.warn('[sqlite] sqlite-vec failed to load — vector search unavailable:', err.message);
  }

  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Apply schema idempotently on first connection
  const schema = readFileSync(
    path.join(__dirname, '../sqlite-schema.sql'),
    'utf-8'
  );
  _db.exec(schema);

  return _db;
}

// ---------------------------------------------------------------------------
// Raw query — wraps sync better-sqlite3 in Promise for uniform async interface
// ---------------------------------------------------------------------------
export async function query(sql, params = []) {
  const db   = getDb();
  const stmt = db.prepare(sql);
  const up   = sql.trim().toUpperCase();

  if (up.startsWith('SELECT') || up.includes('RETURNING')) {
    return { rows: stmt.all(...params) };
  }
  const result = stmt.run(...params);
  return { rows: [], rowCount: result.changes };
}

// ---------------------------------------------------------------------------
// Generic CRUD helpers
// ---------------------------------------------------------------------------
function buildWhere(conditions) {
  const keys = Object.keys(conditions);
  if (!keys.length) return { text: '', values: [] };
  const text = ' WHERE ' + keys.map((k) => `"${k}" = ?`).join(' AND ');
  return { text, values: Object.values(conditions) };
}

export async function getOne(table, conditions = {}) {
  const db = getDb();
  const { text, values } = buildWhere(conditions);
  return db.prepare(`SELECT * FROM "${table}"${text} LIMIT 1`).get(...values) ?? null;
}

export async function getMany(table, conditions = {}, options = {}) {
  const db = getDb();
  const { text, values } = buildWhere(conditions);
  let sql = `SELECT * FROM "${table}"${text}`;
  if (options.orderBy) sql += ` ORDER BY ${options.orderBy}`;
  if (options.limit  != null) sql += ` LIMIT ${options.limit}`;
  if (options.offset != null) sql += ` OFFSET ${options.offset}`;
  return db.prepare(sql).all(...values);
}

export async function insert(table, data) {
  const db = getDb();
  if (!data.id) data = { id: uuidv4(), ...data };
  const keys   = Object.keys(data);
  const values = Object.values(data);
  const cols   = keys.map((k) => `"${k}"`).join(', ');
  const phs    = keys.map(() => '?').join(', ');
  return db.prepare(
    `INSERT INTO "${table}" (${cols}) VALUES (${phs}) RETURNING *`
  ).get(...values);
}

export async function update(table, data, conditions = {}) {
  const db = getDb();
  const dataKeys   = Object.keys(data);
  const dataValues = Object.values(data);
  const setClause  = dataKeys.map((k) => `"${k}" = ?`).join(', ');
  const { text: whereText, values: whereValues } = buildWhere(conditions);
  return db.prepare(
    `UPDATE "${table}" SET ${setClause}${whereText} RETURNING *`
  ).all(...dataValues, ...whereValues);
}

export async function upsert(table, data, conflictCols) {
  const db = getDb();
  if (!data.id) data = { id: uuidv4(), ...data };
  const keys   = Object.keys(data);
  const values = Object.values(data);
  const cols   = keys.map((k) => `"${k}"`).join(', ');
  const phs    = keys.map(() => '?').join(', ');
  const updateSet = keys
    .filter((k) => !conflictCols.includes(k))
    .map((k) => `"${k}" = excluded."${k}"`)
    .join(', ');
  const conflict = conflictCols.map((c) => `"${c}"`).join(', ');
  return db.prepare(
    `INSERT INTO "${table}" (${cols}) VALUES (${phs})
     ON CONFLICT (${conflict}) DO UPDATE SET ${updateSet}
     RETURNING *`
  ).get(...values);
}

export async function remove(table, conditions = {}) {
  const db = getDb();
  const { text, values } = buildWhere(conditions);
  return db.prepare(`DELETE FROM "${table}"${text} RETURNING *`).all(...values);
}

// ---------------------------------------------------------------------------
// Embedding-specific helpers
// Vectors stored as raw little-endian float32 bytes (BLOB).
// sqlite-vec's vec_distance_cosine() accepts this format natively.
// ---------------------------------------------------------------------------

/** Encode a JS number[] to a Float32 BLOB that sqlite-vec understands. */
function toFloat32Blob(arr) {
  return Buffer.from(new Float32Array(arr).buffer);
}

/**
 * Insert one embedding chunk (stores vector as BLOB in embeddings table).
 * @param {{ id: string, entry_id: string, embedding: number[], model_used: string, chunk_text_encrypted: string, chunk_index: number }} data
 */
export async function insertEmbedding(data) {
  const { embedding, ...rest } = data;
  return insert('embeddings', {
    ...rest,
    embedding_blob: toFloat32Blob(embedding),
  });
}

/**
 * Cosine similarity search using sqlite-vec's vec_distance_cosine().
 * Full table scan — acceptable for single-user diary datasets (< 10k chunks).
 * @param {string} user_id
 * @param {number[]} queryVector
 * @param {{ k?: number, threshold?: number }} options
 */
export async function vectorSearch(user_id, queryVector, { k = 5, threshold = 0.7 } = {}) {
  const db        = getDb();
  const queryBlob = toFloat32Blob(queryVector);

  const rows = db.prepare(`
    SELECT
      em.id,
      em.entry_id,
      em.chunk_index,
      em.chunk_text_encrypted,
      em.model_used,
      1 - vec_distance_cosine(em.embedding_blob, ?) AS score
    FROM embeddings em
    JOIN entries e ON e.id = em.entry_id
    WHERE e.user_id = ?
      AND 1 - vec_distance_cosine(em.embedding_blob, ?) >= ?
    ORDER BY score DESC
    LIMIT ?
  `).all(queryBlob, user_id, queryBlob, threshold, k);

  return rows;
}
