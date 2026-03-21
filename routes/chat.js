import { Router } from "express";
import { Embeddings } from "../db/models/embeddings.js";
import { generateEmbedding } from "../services/embedding.js";
import { streamChat } from "../services/llm.js";
import { DEFAULT_USER_ID } from "../db/seed.js";

const router = Router();

/**
 * POST /api/chat
 * Body: { message: string, history?: [{role, content}] }
 *
 * Streams the active provider's response as Server-Sent Events (SSE).
 * Uses vector similarity search to find the top-5 most relevant diary
 * chunks for the user's message (true RAG, not just recency).
 */
router.post("/", async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  // Embed the user's message and retrieve semantically relevant chunks
  let context = "";
  try {
    const queryVec = await generateEmbedding(message);
    const chunks = await Embeddings.similaritySearch(DEFAULT_USER_ID, queryVec, {
      k: 5,
      threshold: 0.3,
    });
    context = chunks.map((c) => c.chunk_text_encrypted).join("\n\n");
  } catch (err) {
    console.warn("[rag] vector search failed, proceeding without context:", err.message);
  }

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
