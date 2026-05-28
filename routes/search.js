import { Router } from "express";
import { Embeddings } from "../db/models/embeddings.js";
import { Entries } from "../db/models/entries.js";
import { generateEmbedding } from "../services/embedding.js";
import { decrypt } from "../services/encryption.js";

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
  const chunks = await Embeddings.similaritySearch(req.user.id, queryVec, {
    k,
    threshold: 0.3,
  });

  if (chunks.length === 0) return res.json([]);

  // Deduplicate chunks by entry_id, then batch-fetch entries in parallel
  const seen = new Set();
  const uniqueChunks = chunks.filter((c) => {
    if (seen.has(c.entry_id)) return false;
    seen.add(c.entry_id);
    return true;
  });

  const entries = await Promise.all(uniqueChunks.map((c) => Entries.getById(c.entry_id)));

  const results = uniqueChunks
    .map((chunk, i) => {
      const entry = entries[i];
      if (!entry) return null;
      return {
        id: entry.id,
        title: decrypt(entry.title_encrypted),
        body: decrypt(entry.body_encrypted),
        writtenAt: entry.written_at,
        score: chunk.score,
      };
    })
    .filter(Boolean);

  res.json(results);
});

export default router;
