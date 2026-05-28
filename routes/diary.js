import { Router } from "express";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { Entries } from "../db/models/entries.js";
import { Embeddings } from "../db/models/embeddings.js";
import { Analysis } from "../db/models/analysis.js";
import { analyzeEntry } from "../services/llm.js";

async function retryAnalyze(text, attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await analyzeEntry(text);
    } catch (err) {
      const is429 = err.message?.includes("429") || err.status === 429;
      if (!is429 || i === attempts - 1) throw err;
      const wait = (i + 1) * 8000;
      console.warn(`[analyze] 429 rate limit, retrying in ${wait / 1000}s…`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}
import { generateEmbedding } from "../services/embedding.js";
import { encrypt, decrypt } from "../services/encryption.js";

const router = Router();

function toResponse(row) {
  return {
    id: row.id,
    title: decrypt(row.title_encrypted),
    body: decrypt(row.body_encrypted),
    writtenAt: row.written_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/diary — list all entries for the authenticated user
router.get("/", async (req, res) => {
  try {
    const rows = await Entries.getAllByUser(req.user.id);
    res.json(rows.map(toResponse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/diary/:id — get single entry (must belong to user)
router.get("/:id", async (req, res) => {
  try {
    const row = await Entries.getById(req.params.id);
    if (!row) return res.status(404).json({ error: "Entry not found" });
    if (row.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const analysis = await Analysis.getByEntry(row.id);
    res.json({
      ...toResponse(row),
      analysis: analysis ? {
        mood: analysis.mood,
        themes: analysis.themes ? JSON.parse(analysis.themes) : [],
        reflection: analysis.reflection_encrypted ? decrypt(analysis.reflection_encrypted) : null,
        followUpQuestion: analysis.follow_up_question,
      } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/diary — create entry, analyze + embed async
router.post("/", async (req, res) => {
  try {
    const { title, body, writtenAt } = req.body;
    if (!body) return res.status(400).json({ error: "body is required" });

    const entry = await Entries.create({
      id: uuidv4(),
      user_id: req.user.id,
      title_encrypted: encrypt(title || "Untitled"),
      body_encrypted: encrypt(body),
      content_hash: createHash("sha256").update(body).digest("hex"),
      written_at: writtenAt || new Date().toISOString(),
    });

    retryAnalyze(body, 3)
      .then((analysis) =>
        Analysis.create({
          id: uuidv4(),
          entry_id: entry.id,
          mood: analysis.mood,
          themes: analysis.themes,
          reflection_encrypted: encrypt(analysis.reflection || ""),
          follow_up_question: analysis.followUpQuestion,
        })
      )
      .then(() => console.log("[analyze] saved for entry", entry.id))
      .catch((err) => console.error("[analyze] failed for entry", entry.id, err.message));

    generateEmbedding(body)
      .then((vector) =>
        Embeddings.create({
          id: uuidv4(),
          entry_id: entry.id,
          embedding: vector,
          model_used: process.env.EMBEDDING_PROVIDER || "ollama",
          chunk_text_encrypted: encrypt(body),
          chunk_index: 0,
        })
      )
      .then(() => console.log("[embed] saved embedding for entry", entry.id))
      .catch((err) => console.error("[embed] FAILED for entry", entry.id, "—", err.message));

    res.status(201).json(toResponse(entry));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/diary/:id — update entry (must belong to user)
router.patch("/:id", async (req, res) => {
  try {
    const row = await Entries.getById(req.params.id);
    if (!row) return res.status(404).json({ error: "Entry not found" });
    if (row.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const { title, body, writtenAt } = req.body;
    const updates = {};
    if (title !== undefined) updates.title_encrypted = encrypt(title);
    if (body !== undefined) {
      updates.body_encrypted = encrypt(body);
      updates.content_hash = createHash("sha256").update(body).digest("hex");
    }
    if (writtenAt !== undefined) updates.written_at = writtenAt;

    const rows = await Entries.updateById(req.params.id, updates);
    const updated = Array.isArray(rows) ? rows[0] : rows;
    if (!updated) return res.status(404).json({ error: "Entry not found" });

    if (body !== undefined) {
      const entryId = req.params.id;

      Embeddings.deleteByEntry(entryId)
        .then(() => generateEmbedding(body))
        .then((vector) =>
          Embeddings.create({
            id: uuidv4(),
            entry_id: entryId,
            embedding: vector,
            model_used: process.env.EMBEDDING_PROVIDER || "ollama",
            chunk_text_encrypted: encrypt(body),
            chunk_index: 0,
          })
        )
        .catch((err) => console.error("[embed] re-embed failed for entry", entryId, err.message));

      retryAnalyze(body, 3)
        .then(async (analysis) => {
          const payload = {
            mood: analysis.mood,
            themes: analysis.themes,
            reflection_encrypted: encrypt(analysis.reflection || ""),
            follow_up_question: analysis.followUpQuestion,
          };
          const existing = await Analysis.getByEntry(entryId);
          return existing
            ? Analysis.updateByEntry(entryId, payload)
            : Analysis.create({ id: uuidv4(), entry_id: entryId, ...payload });
        })
        .catch((err) => console.error("[analyze] re-analyze failed for entry", entryId, err.message));
    }

    res.json(toResponse(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /api/diary/:id — delete entry (must belong to user)
router.delete("/:id", async (req, res) => {
  try {
    const row = await Entries.getById(req.params.id);
    if (!row) return res.status(404).json({ error: "Entry not found" });
    if (row.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const rows = await Entries.deleteById(req.params.id);
    if (!rows || (Array.isArray(rows) && rows.length === 0))
      return res.status(404).json({ error: "Entry not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
