import { GoogleGenerativeAI } from "@google/generative-ai";
import { getConfig } from "../../storage/configStore.js";
import { SYSTEM_PROMPT, ANALYZE_PROMPT } from "../prompts.js";

function getClient() {
  const { apiKey } = getConfig();
  return new GoogleGenerativeAI(apiKey ?? process.env.GEMINI_API_KEY);
}

// Gemini uses "model" role instead of "assistant"
function toGeminiHistory(history) {
  return history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export async function analyzeEntry(text) {
  const { model } = getConfig();
  const genAI = getClient();
  const gemini = genAI.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await gemini.generateContent(ANALYZE_PROMPT(text));
  return JSON.parse(result.response.text());
}

export async function streamChat(history, message, context, onDelta) {
  const { model } = getConfig();
  const genAI = getClient();

  const system = context
    ? `${SYSTEM_PROMPT}\n\nUser's recent diary context:\n${context}`
    : SYSTEM_PROMPT;

  const gemini = genAI.getGenerativeModel({
    model,
    systemInstruction: system,
  });

  const chat = gemini.startChat({ history: toGeminiHistory(history) });
  const result = await chat.sendMessageStream(message);

  let fullText = "";
  for await (const chunk of result.stream) {
    const delta = chunk.text();
    if (delta) {
      onDelta(delta);
      fullText += delta;
    }
  }
  return fullText;
}
