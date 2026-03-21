import { Router } from "express";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { Entries } from "../db/models/entries.js";
import { Embeddings } from "../db/models/embeddings.js";
import { analyzeEntry } from "../services/llm.js";
import { generateEmbedding } from "../services/embedding.js";
import { DEFAULT_USER_ID } from "../db/seed.js";

const router = Router();

/** Map DB row (encrypted column names) → friendly response shape */
function toResponse(row) {
  return {
    id: row.id,
    title: row.title_encrypted,
    body: row.body_encrypted,
    writtenAt: row.written_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/diary — list all entries
router.get("/", async (_req, res) => {
  const rows = await Entries.getAllByUser(DEFAULT_USER_ID);
  res.json(rows.map(toResponse));
});

// GET /api/diary/:id — get single entry
router.get("/:id", async (req, res) => {
  const row = await Entries.getById(req.params.id);
  if (!row) return res.status(404).json({ error: "Entry not found" });
  res.json(toResponse(row));
});

// POST /api/diary — create entry, analyze + embed async
router.post("/", async (req, res) => {
  const { title, body, writtenAt } = req.body;
  if (!body) return res.status(400).json({ error: "body is required" });

  const analysis = await analyzeEntry(body);

  const entry = await Entries.create({
    id: uuidv4(),
    user_id: DEFAULT_USER_ID,
    title_encrypted: title || "Untitled",
    body_encrypted: body,
    content_hash: createHash("sha256").update(body).digest("hex"),
    written_at: writtenAt || new Date().toISOString(),
  });

  // Generate and store embedding in background — don't block the response
  generateEmbedding(body)
    .then((vector) =>
      Embeddings.create({
        id: uuidv4(),
        entry_id: entry.id,
        embedding: vector,
        model_used: process.env.EMBEDDING_PROVIDER || "ollama",
        chunk_text_encrypted: body,
        chunk_index: 0,
      })
    )
    .catch((err) => console.error("[embed] failed for entry", entry.id, err.message));

  res.status(201).json({ ...toResponse(entry), analysis });
});

// PATCH /api/diary/:id — update entry
router.patch("/:id", async (req, res) => {
  const { title, body } = req.body;
  const updates = {};
  if (title !== undefined) updates.title_encrypted = title;
  if (body !== undefined) {
    updates.body_encrypted = body;
    updates.content_hash = createHash("sha256").update(body).digest("hex");
  }
  const rows = await Entries.updateById(req.params.id, updates);
  const updated = Array.isArray(rows) ? rows[0] : rows;
  if (!updated) return res.status(404).json({ error: "Entry not found" });
  res.json(toResponse(updated));
});

// DELETE /api/diary/:id — delete entry (cascades to embeddings)
router.delete("/:id", async (req, res) => {
  const rows = await Entries.deleteById(req.params.id);
  if (!rows || (Array.isArray(rows) && rows.length === 0))
    return res.status(404).json({ error: "Entry not found" });
  res.json({ success: true });
});

export default router;
