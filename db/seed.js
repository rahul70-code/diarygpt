/**
 * Single-user seed — ensures a default user row exists so that the
 * entries.user_id FK is satisfied without implementing full auth.
 */
import { upsert } from "./adapter.js";

export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function ensureDefaultUser() {
  await upsert(
    "users",
    {
      id: DEFAULT_USER_ID,
      email: "default@local",
      encryption_key_hash: "no-encryption",
      storage_mode: process.env.STORAGE_MODE || "local",
      embedding_provider: process.env.EMBEDDING_PROVIDER || "ollama",
    },
    ["id"]
  );
}
