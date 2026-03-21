import { Router } from "express";
import { getAllEntries } from "../storage/entriesStore.js";
import { streamChat } from "../services/llm.js";

const router = Router();

/**
 * POST /api/chat
 * Body: { message: string, history?: [{role, content}] }
 *
 * Streams the active provider's response as Server-Sent Events (SSE).
 * Injects the 5 most recent diary entries as context automatically.
 */
router.post("/", async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  const entries = getAllEntries().slice(-5);
  const context = entries
    .map((e) => `[${e.createdAt.slice(0, 10)}] ${e.title}: ${e.body}`)
    .join("\n\n");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const fullText = await streamChat(history, message, context, (delta) => {
    res.write(`data: ${JSON.stringify({ delta })}\n\n`);
  });

  res.write(`data: ${JSON.stringify({ done: true, text: fullText })}\n\n`);
  res.end();
});

export default router;
