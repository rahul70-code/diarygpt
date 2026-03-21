import pool from '../connection.js';
import pgvector from 'pgvector/pg';

// Register the `vector` type parser so pg returns float arrays instead of strings
pool.on('connect', async (client) => {
  await pgvector.registerType(client);
});

// ---------------------------------------------------------------------------
// Raw query
// ---------------------------------------------------------------------------
export async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Generic CRUD helpers
// ---------------------------------------------------------------------------
function buildWhere(conditions) {
  const keys = Object.keys(conditions);
  if (!keys.length) return { text: '', values: [] };
  const text = ' WHERE ' + keys.map((k, i) => `"${k}" = $${i + 1}`).join(' AND ');
  return { text, values: Object.values(conditions) };
}

export async function getOne(table, conditions = {}) {
  const { text, values } = buildWhere(conditions);
  const { rows } = await query(`SELECT * FROM ${table}${text} LIMIT 1`, values);
  return rows[0] ?? null;
}

export async function getMany(table, conditions = {}, options = {}) {
  const { text, values } = buildWhere(conditions);
  let sql = `SELECT * FROM ${table}${text}`;
  if (options.orderBy) sql += ` ORDER BY ${options.orderBy}`;
  if (options.limit  != null) sql += ` LIMIT ${options.limit}`;
  if (options.offset != null) sql += ` OFFSET ${options.offset}`;
  const { rows } = await query(sql, values);
  return rows;
}

export async function insert(table, data) {
  const keys   = Object.keys(data);
  const values = Object.values(data);
  const cols   = keys.map((k) => `"${k}"`).join(', ');
  const phs    = keys.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await query(
    `INSERT INTO ${table} (${cols}) VALUES (${phs}) RETURNING *`,
    values
  );
  return rows[0];
}

export async function update(table, data, conditions = {}) {
  const dataKeys   = Object.keys(data);
  const dataValues = Object.values(data);
  const setClause  = dataKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
  const { text: whereText, values: whereValues } = buildWhere(conditions);
  // Re-number WHERE params after SET params
  const whereRenum = whereText.replace(
    /\$(\d+)/g,
    (_, n) => `$${Number(n) + dataKeys.length}`
  );
  const { rows } = await query(
    `UPDATE ${table} SET ${setClause}${whereRenum} RETURNING *`,
    [...dataValues, ...whereValues]
  );
  return rows;
}

export async function upsert(table, data, conflictCols) {
  const keys   = Object.keys(data);
  const values = Object.values(data);
  const cols   = keys.map((k) => `"${k}"`).join(', ');
  const phs    = keys.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = keys
    .filter((k) => !conflictCols.includes(k))
    .map((k) => `"${k}" = EXCLUDED."${k}"`)
    .join(', ');
  const conflict = conflictCols.map((c) => `"${c}"`).join(', ');
  const { rows } = await query(
    `INSERT INTO ${table} (${cols}) VALUES (${phs})
     ON CONFLICT (${conflict}) DO UPDATE SET ${updateSet}
     RETURNING *`,
    values
  );
  return rows[0];
}

export async function remove(table, conditions = {}) {
  const { text, values } = buildWhere(conditions);
  const { rows } = await query(`DELETE FROM ${table}${text} RETURNING *`, values);
  return rows;
}

// ---------------------------------------------------------------------------
// Embedding-specific helpers (vector stored in embeddings.embedding column)
// ---------------------------------------------------------------------------

/**
 * Insert one embedding chunk.
 * @param {{ id: string, entry_id: string, embedding: number[], model_used: string, chunk_text_encrypted: string, chunk_index: number }} data
 */
export async function insertEmbedding(data) {
  const { embedding, ...rest } = data;
  return insert('embeddings', {
    ...rest,
    embedding: `[${embedding.join(',')}]`,  // pgvector literal format
  });
}

/**
 * Cosine similarity search via pgvector <=> operator.
 * @param {string} user_id
 * @param {number[]} queryVector
 * @param {{ k?: number, threshold?: number }} options
 */
export async function vectorSearch(user_id, queryVector, { k = 5, threshold = 0.7 } = {}) {
  const vec = `[${queryVector.join(',')}]`;
  const sql = `
    SELECT
      em.id,
      em.entry_id,
      em.chunk_index,
      em.chunk_text_encrypted,
      em.model_used,
      1 - (em.embedding <=> $1::vector) AS score
    FROM embeddings em
    JOIN entries e ON e.id = em.entry_id
    WHERE e.user_id = $2
      AND 1 - (em.embedding <=> $1::vector) >= $3
    ORDER BY score DESC
    LIMIT $4
  `;
  const { rows } = await query(sql, [vec, user_id, threshold, k]);
  return rows;
}
