import { Router } from "express";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { Entries } from "../db/models/entries.js";
import { Embeddings } from "../db/models/embeddings.js";
import { analyzeEntry } from "../services/llm.js";
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
    res.status(500).json({ error: err.message });
  }
});

// GET /api/diary/:id — get single entry (must belong to user)
router.get("/:id", async (req, res) => {
  try {
    const row = await Entries.getById(req.params.id);
    if (!row) return res.status(404).json({ error: "Entry not found" });
    if (row.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    res.json(toResponse(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    analyzeEntry(body)
      .then((analysis) => console.log("[analyze] entry", entry.id, analysis))
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
    res.status(500).json({ error: err.message });
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
    res.json(toResponse(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

export default router;
