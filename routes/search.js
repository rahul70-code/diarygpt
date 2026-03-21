import { Router } from "express";
import { Embeddings } from "../db/models/embeddings.js";
import { Entries } from "../db/models/entries.js";
import { generateEmbedding } from "../services/embedding.js";
import { DEFAULT_USER_ID } from "../db/seed.js";

const router = Router();

/**
 * POST /api/search
 * Body: { query: string, k?: number }
 *
 * Semantic search across diary entries using cosine similarity.
 * Returns matched entries ordered by relevance score.
 */
router.post("/", async (req, res) => {
  const { query, k = 5 } = req.body;
  if (!query) return res.status(400).json({ error: "query is required" });

  const queryVec = await generateEmbedding(query);
  const chunks = await Embeddings.similaritySearch(DEFAULT_USER_ID, queryVec, {
    k,
    threshold: 0.3,
  });

  if (chunks.length === 0) return res.json([]);

  // Fetch the full entries for matched chunks (deduplicate by entry_id)
  const seen = new Set();
  const results = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.entry_id)) continue;
    seen.add(chunk.entry_id);
    const entry = await Entries.getById(chunk.entry_id);
    if (entry) {
      results.push({
        id: entry.id,
        title: entry.title_encrypted,
        body: entry.body_encrypted,
        writtenAt: entry.written_at,
        score: chunk.score,
      });
    }
  }

  res.json(results);
});

export default router;
