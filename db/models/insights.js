/**
 * Insights queries — adapter-aware because raw SQL differs between
 * SQLite (? placeholders, strftime) and PostgreSQL ($N placeholders, TO_CHAR/DATE).
 */
const isPg = (process.env.STORAGE_MODE || "local") === "cloud";

async function rawQuery(sqliteSql, pgSql, params) {
  const mod = isPg
    ? await import("../adapters/postgres.js")
    : await import("../adapters/sqlite.js");
  const { rows } = await mod.query(isPg ? pgSql : sqliteSql, params);
  return rows;
}

/** Mood counts + timeline for the last `period` days. */
export async function getMoodData(userId, sinceDate) {
  const counts = await rawQuery(
    `SELECT a.mood, COUNT(*) as count
     FROM analysis a JOIN entries e ON e.id = a.entry_id
     WHERE e.user_id = ? AND a.mood IS NOT NULL AND e.written_at >= ?
     GROUP BY a.mood ORDER BY count DESC`,
    `SELECT a.mood, COUNT(*) as count
     FROM analysis a JOIN entries e ON e.id = a.entry_id
     WHERE e.user_id = $1 AND a.mood IS NOT NULL AND e.written_at >= $2
     GROUP BY a.mood ORDER BY count DESC`,
    [userId, sinceDate]
  );

  const timeline = await rawQuery(
    `SELECT a.mood, date(e.written_at) as day
     FROM analysis a JOIN entries e ON e.id = a.entry_id
     WHERE e.user_id = ? AND a.mood IS NOT NULL AND e.written_at >= ?
     ORDER BY day ASC`,
    `SELECT a.mood, DATE(e.written_at::timestamp) as day
     FROM analysis a JOIN entries e ON e.id = a.entry_id
     WHERE e.user_id = $1 AND a.mood IS NOT NULL AND e.written_at >= $2
     ORDER BY day ASC`,
    [userId, sinceDate]
  );

  return { counts, timeline };
}

/** Total entry count since a date. */
export async function getEntryCount(userId, sinceDate) {
  const rows = await rawQuery(
    `SELECT COUNT(*) as total FROM entries WHERE user_id = ? AND written_at >= ?`,
    `SELECT COUNT(*) as total FROM entries WHERE user_id = $1 AND written_at >= $2`,
    [userId, sinceDate]
  );
  return Number(rows[0]?.total ?? 0);
}

/** All distinct written days, newest first — for streak computation. */
export async function getWrittenDays(userId) {
  const rows = await rawQuery(
    `SELECT DISTINCT date(written_at) as day FROM entries WHERE user_id = ? ORDER BY day DESC`,
    `SELECT DISTINCT DATE(written_at::timestamp) as day FROM entries WHERE user_id = $1 ORDER BY day DESC`,
    [userId]
  );
  return rows.map((r) => r.day);
}

/** Entries written on the same month-day in prior years ("on this day"). */
export async function getMemories(userId) {
  return rawQuery(
    `SELECT id, title_encrypted, body_encrypted, written_at FROM entries
     WHERE user_id = ?
       AND strftime('%m-%d', written_at) = strftime('%m-%d', 'now')
       AND strftime('%Y',    written_at) < strftime('%Y',    'now')
     ORDER BY written_at DESC LIMIT 3`,
    `SELECT id, title_encrypted, body_encrypted, written_at FROM entries
     WHERE user_id = $1
       AND TO_CHAR(written_at::timestamp, 'MM-DD') = TO_CHAR(NOW(), 'MM-DD')
       AND EXTRACT(YEAR FROM written_at::timestamp) < EXTRACT(YEAR FROM NOW())
     ORDER BY written_at DESC LIMIT 3`,
    [userId]
  );
}

/** Most recent N entries' bodies (for journaling prompt RAG). */
export async function getRecentBodies(userId, limit = 3) {
  return rawQuery(
    `SELECT body_encrypted FROM entries WHERE user_id = ? ORDER BY written_at DESC LIMIT ?`,
    `SELECT body_encrypted FROM entries WHERE user_id = $1 ORDER BY written_at DESC LIMIT $2`,
    [userId, limit]
  );
}

/** Entries from the last 7 days for weekly summary. */
export async function getWeeklyEntries(userId) {
  const sinceDate = new Date(Date.now() - 7 * 86400000).toISOString();
  return rawQuery(
    `SELECT title_encrypted, body_encrypted, written_at FROM entries
     WHERE user_id = ? AND written_at >= ? ORDER BY written_at ASC`,
    `SELECT title_encrypted, body_encrypted, written_at FROM entries
     WHERE user_id = $1 AND written_at >= $2 ORDER BY written_at ASC`,
    [userId, sinceDate]
  );
}

/** Compute current writing streak from a DESC-sorted list of ISO date strings. */
export function computeStreak(sortedDays) {
  if (!sortedDays.length) return 0;
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Streak is only active if user wrote today or yesterday
  if (sortedDays[0] !== today && sortedDays[0] !== yesterday) return 0;

  let streak   = 0;
  let expected = sortedDays[0];

  for (const day of sortedDays) {
    if (day === expected) {
      streak++;
      const d = new Date(expected + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      expected = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }
  return streak;
}
