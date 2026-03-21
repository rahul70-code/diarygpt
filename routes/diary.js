import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  getAllEntries,
  getEntryById,
  saveEntry,
  updateEntry,
  deleteEntry,
} from "../storage/entriesStore.js";
import { analyzeEntry } from "../services/llm.js";

const router = Router();

// GET /api/diary — list all entries
router.get("/", (_req, res) => {
  const entries = getAllEntries();
  res.json(entries);
});

// GET /api/diary/:id — get a single entry
router.get("/:id", (req, res) => {
  const entry = getEntryById(req.params.id);
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  res.json(entry);
});

// POST /api/diary — create a new entry (auto-analyzes with Claude)
router.post("/", async (req, res) => {
  const { title, body } = req.body;
  if (!body) return res.status(400).json({ error: "body is required" });

  const analysis = await analyzeEntry(body);

  const entry = saveEntry({
    id: uuidv4(),
    title: title || "Untitled",
    body,
    analysis,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json(entry);
});

// PATCH /api/diary/:id — update an entry
router.patch("/:id", (req, res) => {
  const updated = updateEntry(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Entry not found" });
  res.json(updated);
});

// DELETE /api/diary/:id — delete an entry
router.delete("/:id", (req, res) => {
  const deleted = deleteEntry(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Entry not found" });
  res.json({ success: true });
});

export default router;
