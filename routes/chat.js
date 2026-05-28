import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { Embeddings } from "../db/models/embeddings.js";
import { Entries } from "../db/models/entries.js";
import { ChatSessions } from "../db/models/chatSessions.js";
import { ChatMessages } from "../db/models/chatMessages.js";
import { generateEmbedding } from "../services/embedding.js";
import { streamChat, streamWithSystemPrompt } from "../services/llm.js";
import { SYSTEM_PROMPT } from "../services/prompts.js";
import { encrypt, decrypt } from "../services/encryption.js";

const router = Router();

// GET /api/chat/sessions — list all sessions for the authenticated user
router.get("/sessions", async (req, res) => {
  try {
    const sessions = await ChatSessions.getAllByUser(req.user.id);
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/chat/sessions/:id/messages — get all messages in a session
router.get("/sessions/:id/messages", async (req, res) => {
  try {
    const session = await ChatSessions.getById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const messages = await ChatMessages.getBySession(req.params.id);
    res.json(
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: decrypt(m.content_encrypted),
        createdAt: m.created_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /api/chat/sessions/:id — delete a session and all its messages
router.delete("/sessions/:id", async (req, res) => {
  try {
    const session = await ChatSessions.getById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    await ChatSessions.deleteById(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /api/chat
 * Body: { message: string, sessionId?: string }
 *
 * Streams the AI response as Server-Sent Events.
 * Persists user + assistant messages to DB per session.
 * If no sessionId is provided, a new session is created and its id is returned
 * in the final `done` event so the client can continue the conversation.
 */
router.post("/", async (req, res) => {
  const { message, sessionId, entryId } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  let session;
  try {
    if (sessionId) {
      session = await ChatSessions.getById(sessionId);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (session.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    } else {
      const title = message.length > 50 ? message.slice(0, 47) + "…" : message;
      session = await ChatSessions.create({ id: uuidv4(), user_id: req.user.id, title });
    }

    // Persist user message immediately
    await ChatMessages.create({
      id: uuidv4(),
      session_id: session.id,
      role: "user",
      content_encrypted: encrypt(message),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }

  // Load conversation history from DB for LLM context
  let history = [];
  try {
    const dbMessages = await ChatMessages.getBySession(session.id, { limit: 40 });
    // Exclude the message we just inserted (last item); use the rest as history
    history = dbMessages
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: decrypt(m.content_encrypted) }));
  } catch (err) {
    console.warn("[chat] failed to load history:", err.message);
  }

  // Context: use specific entry if entryId provided, otherwise RAG over all entries
  let context = "";
  let contextEntryIds = [];
  if (entryId) {
    try {
      const entry = await Entries.getById(entryId);
      if (entry && entry.user_id === req.user.id) {
        context = decrypt(entry.body_encrypted);
        contextEntryIds = [entryId];
      }
    } catch (err) {
      console.warn("[chat] failed to load entry context:", err.message);
    }
  } else {
    try {
      const queryVec = await generateEmbedding(message);
      const chunks = await Embeddings.similaritySearch(req.user.id, queryVec, {
        k: 5,
        threshold: 0.3,
      });
      contextEntryIds = [...new Set(chunks.map((c) => c.entry_id))];
      context = chunks.map((c) => decrypt(c.chunk_text_encrypted)).join("\n\n");
    } catch (err) {
      console.warn("[rag] vector search failed, proceeding without context:", err.message);
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const onDelta = (delta) => res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    const system = context
      ? `${SYSTEM_PROMPT}\n\nDiary entry context:\n${context}`
      : SYSTEM_PROMPT;
    const fullText = entryId
      ? await streamWithSystemPrompt(system, history, message, onDelta)
      : await streamChat(history, message, context, onDelta);

    // Persist assistant response
    await ChatMessages.create({
      id: uuidv4(),
      session_id: session.id,
      role: "assistant",
      content_encrypted: encrypt(fullText),
      context_entry_ids: contextEntryIds,
    });

    res.write(`data: ${JSON.stringify({ done: true, text: fullText, sessionId: session.id })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: "Internal Server Error" })}\n\n`);
    res.end();
  }
});

export default router;
