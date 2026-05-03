import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { TherapySessions } from "../db/models/therapySessions.js";
import { TherapyMessages } from "../db/models/therapyMessages.js";
import { MoodLogs } from "../db/models/moodLogs.js";
import { encrypt, decrypt } from "../services/encryption.js";
import { streamWithSystemPrompt } from "../services/llm.js";
import { THERAPIST_SYSTEM_PROMPT } from "../services/prompts.js";

const router = Router();

// ─── Crisis detection ─────────────────────────────────────────────────────────
// Checked BEFORE any LLM call. If triggered: hardcoded response, LLM is never invoked.
const CRISIS_KEYWORDS = [
  "suicide", "suicidal", "kill myself", "end my life", "want to die",
  "self-harm", "self harm", "cut myself", "hurt myself", "harm myself",
  "no reason to live", "better off dead", "can't go on", "cant go on",
  "don't want to be here", "dont want to be here",
];

const CRISIS_MESSAGE = `I'm really glad you reached out, and I want you to know you're not alone in this.

What you're sharing sounds incredibly painful. Please reach out to someone who can support you right now:

🇺🇸 988 Suicide & Crisis Lifeline — call or text 988 (US, 24/7, free)
💬 Crisis Text Line — text HOME to 741741 (US, UK, Canada)
🌍 International resources — https://findahelpline.com

You matter deeply. These services are confidential and available right now.`;

function detectCrisis(message) {
  const lower = message.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

function sseWrite(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── GET /api/therapy/sessions ────────────────────────────────────────────────
router.get("/sessions", async (req, res) => {
  try {
    const sessions = await TherapySessions.getAllByUser(req.user.id);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/therapy/sessions/:id/messages ───────────────────────────────────
router.get("/sessions/:id/messages", async (req, res) => {
  try {
    const session = await TherapySessions.getById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const msgs = await TherapyMessages.getBySession(req.params.id);
    res.json(msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: decrypt(m.content_encrypted),
      createdAt: m.created_at,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/therapy/sessions/:id ────────────────────────────────────────
router.delete("/sessions/:id", async (req, res) => {
  try {
    const session = await TherapySessions.getById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    await TherapySessions.deleteById(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/therapy/session — main chat endpoint (SSE) ────────────────────
router.post("/session", async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // ── Crisis gate — runs BEFORE any LLM call ──────────────────────────────────
  if (detectCrisis(message)) {
    let session;
    try {
      if (sessionId) {
        session = await TherapySessions.getById(sessionId);
        if (session?.user_id === req.user.id) {
          await TherapySessions.flag(session.id);
        }
      }
      if (!session) {
        session = await TherapySessions.create({
          id: uuidv4(),
          user_id: req.user.id,
          title: message.slice(0, 50),
          flagged: 1,
        });
      }
      await TherapyMessages.create({ id: uuidv4(), session_id: session.id, role: "user",      content_encrypted: encrypt(message) });
      await TherapyMessages.create({ id: uuidv4(), session_id: session.id, role: "assistant", content_encrypted: encrypt(CRISIS_MESSAGE) });
    } catch (e) {
      console.error("[therapy] crisis log error:", e.message);
    }
    sseWrite(res, { delta: CRISIS_MESSAGE });
    sseWrite(res, { done: true, text: CRISIS_MESSAGE, sessionId: session?.id, crisis: true });
    return res.end();
  }

  // ── Normal flow ──────────────────────────────────────────────────────────────
  let session;
  try {
    if (sessionId) {
      session = await TherapySessions.getById(sessionId);
      if (!session) return res.end(); // silently end SSE
      if (session.user_id !== req.user.id) return res.end();
    } else {
      session = await TherapySessions.create({
        id: uuidv4(),
        user_id: req.user.id,
        title: message.length > 50 ? message.slice(0, 47) + "…" : message,
        flagged: 0,
      });
    }
    await TherapyMessages.create({
      id: uuidv4(),
      session_id: session.id,
      role: "user",
      content_encrypted: encrypt(message),
    });
  } catch (err) {
    sseWrite(res, { error: err.message });
    return res.end();
  }

  // Build conversation history for LLM context
  let history = [];
  try {
    const all = await TherapyMessages.getBySession(session.id, { limit: 40 });
    history = all.slice(0, -1).map((m) => ({ role: m.role, content: decrypt(m.content_encrypted) }));
  } catch (e) {
    console.warn("[therapy] history load failed:", e.message);
  }

  try {
    const fullText = await streamWithSystemPrompt(
      THERAPIST_SYSTEM_PROMPT,
      history,
      message,
      (delta) => sseWrite(res, { delta }),
    );

    await TherapyMessages.create({
      id: uuidv4(),
      session_id: session.id,
      role: "assistant",
      content_encrypted: encrypt(fullText),
    });

    sseWrite(res, { done: true, text: fullText, sessionId: session.id });
  } catch (err) {
    sseWrite(res, { error: err.message });
  }
  res.end();
});

// ─── POST /api/therapy/mood ───────────────────────────────────────────────────
router.post("/mood", async (req, res) => {
  const { score, note } = req.body;
  if (!score || score < 1 || score > 10)
    return res.status(400).json({ error: "score must be 1–10" });

  try {
    const log = await MoodLogs.create({
      id: uuidv4(),
      user_id: req.user.id,
      score: Math.round(score),
      note_encrypted: note ? encrypt(note) : null,
    });
    res.status(201).json({ id: log.id, score: log.score, loggedAt: log.logged_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/therapy/mood/history?days=30 ────────────────────────────────────
router.get("/mood/history", async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 365);
  const sinceDate = new Date(Date.now() - days * 86400000).toISOString();
  try {
    const logs = await MoodLogs.getByUser(req.user.id);
    res.json(
      logs
        .filter((l) => l.logged_at >= sinceDate)
        .map((l) => ({
          id:       l.id,
          score:    l.score,
          note:     l.note_encrypted ? decrypt(l.note_encrypted) : null,
          loggedAt: l.logged_at,
        }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
