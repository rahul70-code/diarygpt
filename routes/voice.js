import { Router } from "express";
import multer from "multer";
import OpenAI from "openai";
import { getConfig } from "../storage/configStore.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function getClient() {
  const { apiKey } = getConfig();
  return new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
}

/**
 * POST /api/voice/transcribe
 * Accepts: multipart/form-data with field `audio` (webm/mp4/wav/m4a)
 * Returns: { text: string }
 * Uses OpenAI Whisper — ~$0.006/min, much more accurate than browser STT.
 */
router.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "audio file is required" });

  try {
    const client = getClient();
    const audioFile = new File(
      [req.file.buffer],
      `audio.${req.file.mimetype?.split("/")[1] || "webm"}`,
      { type: req.file.mimetype || "audio/webm" }
    );

    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
    });

    res.json({ text: transcription.text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/voice/speak
 * Body: { text: string, voice?: "alloy"|"echo"|"fable"|"nova"|"onyx"|"shimmer" }
 * Returns: audio/mpeg stream (MP3)
 * Uses OpenAI TTS-1 — warm, natural voices vs robotic browser SpeechSynthesis.
 */
router.post("/speak", async (req, res) => {
  const { text, voice = "nova" } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });

  const VALID_VOICES = ["alloy", "echo", "fable", "nova", "onyx", "shimmer"];
  const selectedVoice = VALID_VOICES.includes(voice) ? voice : "nova";

  try {
    const client = getClient();
    const mp3 = await client.audio.speech.create({
      model: "tts-1",
      voice: selectedVoice,
      input: text.slice(0, 4096),
    });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
