/**
 * Single-user seed — ensures a default user row exists so that the
 * entries.user_id FK is satisfied without implementing full auth.
 */
import { query } from "./adapter.js";

export const DEFAULT_USER_ID = "default";

export async function ensureDefaultUser() {
  await query(
    `INSERT OR IGNORE INTO users (id, email, encryption_key_hash, storage_mode, embedding_provider)
     VALUES (?, ?, ?, ?, ?)`,
    [
      DEFAULT_USER_ID,
      "default@local",
      "no-encryption",
      "local",
      process.env.EMBEDDING_PROVIDER || "ollama",
    ]
  );
}
