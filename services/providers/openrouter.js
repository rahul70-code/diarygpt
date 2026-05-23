// OpenRouter — free models for diary entry analysis
import OpenAI from "openai";
import { SYSTEM_PROMPT, ANALYZE_PROMPT } from "../prompts.js";

const MODEL = "meta-llama/llama-3.3-70b-instruct:free";

function getClient() {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

export async function analyzeEntry(text) {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: ANALYZE_PROMPT(text) },
    ],
  });

  const raw = response.choices[0].message.content ?? "{}";
  // Strip markdown code fences if the model wraps JSON in ```json ... ```
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.warn("[openrouter] JSON parse failed, returning empty analysis. Raw:", raw.slice(0, 200));
    return {};
  }
}
