// One-shot script: analyze all diary entries that are missing analysis
import "dotenv/config";
import { v4 as uuidv4 } from "uuid";
import { getMany, insert } from "../db/helpers.js";
import { decrypt, encrypt } from "../services/encryption.js";
import { analyzeEntry } from "../services/llm.js";

const entries = await getMany("entries", {});
const analyses = await getMany("analysis", {});
const analyzed = new Set(analyses.map((a) => a.entry_id));

const missing = entries.filter((e) => !analyzed.has(e.id));
console.log(`Found ${missing.length} entries without analysis.`);

for (const entry of missing) {
  const body = decrypt(entry.body_encrypted);
  console.log(`Analyzing entry ${entry.id.slice(0, 8)}…`);
  try {
    const result = await analyzeEntry(body);
    await insert("analysis", {
      id: uuidv4(),
      entry_id: entry.id,
      mood: result.mood ?? null,
      themes: result.themes ? JSON.stringify(result.themes) : null,
      reflection_encrypted: result.reflection ? encrypt(result.reflection) : null,
      follow_up_question: result.followUpQuestion ?? null,
    });
    console.log(`  ✓ mood: ${result.mood} | themes: ${(result.themes || []).join(", ")}`);
  } catch (err) {
    console.error(`  ✗ failed: ${err.message}`);
  }
  // Respect Groq 30 req/min rate limit
  await new Promise((r) => setTimeout(r, 2500));
}

console.log("Done.");
