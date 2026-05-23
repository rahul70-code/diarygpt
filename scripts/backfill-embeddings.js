// One-shot script: embed all diary entries missing embeddings
import "dotenv/config";
import { v4 as uuidv4 } from "uuid";
import Database from "better-sqlite3";
import { generateEmbedding } from "../services/embedding.js";
import { encrypt, decrypt } from "../services/encryption.js";

const db = new Database("./data/diary.db");
const missing = db.prepare(`
  SELECT e.id, e.body_encrypted FROM entries e
  LEFT JOIN embeddings em ON em.entry_id = e.id
  WHERE em.id IS NULL
`).all();

console.log(`Found ${missing.length} entries without embeddings.`);

for (const row of missing) {
  const body = decrypt(row.body_encrypted);
  console.log(`Embedding entry ${row.id.slice(0, 8)}…`);
  try {
    const vec = await generateEmbedding(body);
    const blob = Buffer.alloc(vec.length * 4);
    vec.forEach((v, i) => blob.writeFloatLE(v, i * 4));
    db.prepare(`
      INSERT INTO embeddings (id, entry_id, embedding_blob, model_used, chunk_text_encrypted, chunk_index)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(uuidv4(), row.id, blob, "jina", encrypt(body));
    console.log(`  ✓ ${vec.length} dims`);
  } catch (err) {
    console.error(`  ✗ failed: ${err.message}`);
  }
}

db.close();
console.log("Done.");
