import pool from "./connection.js";

/** Run a raw SQL query. */
export async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * SELECT a single row.
 * @param {string} table
 * @param {Record<string, unknown>} conditions  e.g. { id: '123' }
 * @returns {object|null}
 */
export async function getOne(table, conditions = {}) {
  const { text, values } = buildWhere(conditions);
  const sql = `SELECT * FROM ${table}${text} LIMIT 1`;
  const { rows } = await query(sql, values);
  return rows[0] ?? null;
}

/**
 * SELECT multiple rows.
 * @param {string} table
 * @param {Record<string, unknown>} conditions
 * @param {{ orderBy?: string, limit?: number, offset?: number }} options
 * @returns {object[]}
 */
export async function getMany(table, conditions = {}, options = {}) {
  const { text, values } = buildWhere(conditions);
  let sql = `SELECT * FROM ${table}${text}`;
  if (options.orderBy) sql += ` ORDER BY ${options.orderBy}`;
  if (options.limit != null) sql += ` LIMIT ${options.limit}`;
  if (options.offset != null) sql += ` OFFSET ${options.offset}`;
  const { rows } = await query(sql, values);
  return rows;
}

/**
 * INSERT a row and return it.
 * @param {string} table
 * @param {Record<string, unknown>} data
 * @returns {object}
 */
export async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`;
  const { rows } = await query(sql, values);
  return rows[0];
}

/**
 * UPDATE rows matching conditions and return updated rows.
 * @param {string} table
 * @param {Record<string, unknown>} data     columns to update
 * @param {Record<string, unknown>} conditions
 * @returns {object[]}
 */
export async function update(table, data, conditions = {}) {
  const dataKeys = Object.keys(data);
  const dataValues = Object.values(data);

  const setClause = dataKeys
    .map((k, i) => `"${k}" = $${i + 1}`)
    .join(", ");

  const condKeys = Object.keys(conditions);
  const condValues = Object.values(conditions);
  const whereClause = condKeys.length
    ? " WHERE " +
      condKeys
        .map((k, i) => `"${k}" = $${dataKeys.length + i + 1}`)
        .join(" AND ")
    : "";

  const sql = `UPDATE ${table} SET ${setClause}${whereClause} RETURNING *`;
  const { rows } = await query(sql, [...dataValues, ...condValues]);
  return rows;
}

/**
 * INSERT … ON CONFLICT (conflictCols) DO UPDATE SET … RETURNING *
 * @param {string} table
 * @param {Record<string, unknown>} data
 * @param {string[]} conflictCols  columns that form the unique constraint
 * @returns {object}
 */
export async function upsert(table, data, conflictCols) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

  const updateSet = keys
    .filter((k) => !conflictCols.includes(k))
    .map((k) => `"${k}" = EXCLUDED."${k}"`)
    .join(", ");

  const conflict = conflictCols.map((c) => `"${c}"`).join(", ");
  const sql = `
    INSERT INTO ${table} (${cols}) VALUES (${placeholders})
    ON CONFLICT (${conflict}) DO UPDATE SET ${updateSet}
    RETURNING *`;
  const { rows } = await query(sql, values);
  return rows[0];
}

/**
 * DELETE rows matching conditions and return deleted rows.
 * @param {string} table
 * @param {Record<string, unknown>} conditions
 * @returns {object[]}
 */
export async function remove(table, conditions = {}) {
  const { text, values } = buildWhere(conditions);
  const sql = `DELETE FROM ${table}${text} RETURNING *`;
  const { rows } = await query(sql, values);
  return rows;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildWhere(conditions) {
  const keys = Object.keys(conditions);
  if (!keys.length) return { text: "", values: [] };
  const text =
    " WHERE " + keys.map((k, i) => `"${k}" = $${i + 1}`).join(" AND ");
  return { text, values: Object.values(conditions) };
}
