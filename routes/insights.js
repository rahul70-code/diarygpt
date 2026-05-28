import { Router } from "express";
import { decrypt } from "../services/encryption.js";
import { generateText } from "../services/llm.js";
import { WEEKLY_SUMMARY_PROMPT, JOURNALING_PROMPT_SYSTEM } from "../services/prompts.js";
import {
  getMoodData,
  getEntryCount,
  getWrittenDays,
  getMemories,
  getRecentBodies,
  getWeeklyEntries,
  computeStreak,
} from "../db/models/insights.js";

const router = Router();

/**
 * GET /api/insights/mood?period=30
 * Returns mood distribution, timeline, streak, and "on this day" memories.
 */
router.get("/mood", async (req, res) => {
  const period    = Math.min(parseInt(req.query.period) || 30, 365);
  const userId    = req.user.id;
  const sinceDate = new Date(Date.now() - period * 86400000).toISOString();

  try {
    const [{ counts, timeline }, total, days, memoryRows] = await Promise.all([
      getMoodData(userId, sinceDate),
      getEntryCount(userId, sinceDate),
      getWrittenDays(userId),
      getMemories(userId),
    ]);

    const moodCounts = {};
    for (const row of counts) moodCounts[row.mood] = Number(row.count);

    const memories = memoryRows.map((r) => ({
      id:        r.id,
      title:     decrypt(r.title_encrypted),
      snippet:   decrypt(r.body_encrypted).slice(0, 180),
      writtenAt: r.written_at,
      yearsAgo:  new Date().getFullYear() - new Date(r.written_at).getFullYear(),
    }));

    res.json({
      period,
      totalEntries: total,
      moodCounts,
      moodTimeline: timeline,
      streak:       computeStreak(days),
      memories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /api/insights/weekly
 * Generates an AI weekly reflection summary from the last 7 days of entries.
 */
router.post("/weekly", async (req, res) => {
  const userId = req.user.id;

  try {
    const rows = await getWeeklyEntries(userId);

    if (rows.length === 0) {
      return res.json({
        summary: "You haven't written any entries this week. Even a few sentences today is a great start.",
      });
    }

    const entriesText = rows
      .map((r) => {
        const title = decrypt(r.title_encrypted);
        const body  = decrypt(r.body_encrypted);
        const date  = new Date(r.written_at).toLocaleDateString("en-US", {
          weekday: "long", month: "short", day: "numeric",
        });
        return `[${date}] ${title}\n${body}`;
      })
      .join("\n\n---\n\n");

    const summary = await generateText(WEEKLY_SUMMARY_PROMPT, entriesText);
    res.json({ summary: summary.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/insights/prompt
 * Generates a personalised journaling prompt based on recent entries.
 */
router.get("/prompt", async (req, res) => {
  const userId = req.user.id;

  try {
    const rows = await getRecentBodies(userId, 3);

    if (rows.length === 0) {
      return res.json({ prompt: "What's been on your mind lately that you haven't had a chance to write about?" });
    }

    const recentText = rows.map((r) => decrypt(r.body_encrypted)).join("\n\n");
    const prompt     = await generateText(JOURNALING_PROMPT_SYSTEM, recentText);
    res.json({ prompt: prompt.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
