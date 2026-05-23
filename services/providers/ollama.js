// Ollama — fully local inference, zero data leaves the machine
import OpenAI from "openai";
import { getConfig } from "../../storage/configStore.js";
import { SYSTEM_PROMPT, ANALYZE_PROMPT } from "../prompts.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

function getClient() {
  return new OpenAI({
    apiKey: "ollama",
    baseURL: `${OLLAMA_URL}/v1`,
  });
}

export async function analyzeEntry(text) {
  const { model } = getConfig();
  const client = getClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT + "\n\nRespond with valid JSON only. No markdown, no explanation." },
      { role: "user", content: ANALYZE_PROMPT(text) },
    ],
  });
  const raw = response.choices[0].message.content ?? "{}";
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return {};
  }
}

export async function generateText(systemPrompt, userMessage) {
  const { model } = getConfig();
  const client = getClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });
  return response.choices[0].message.content ?? "";
}

export async function streamChat(history, message, context, onDelta) {
  const { model } = getConfig();
  const client = getClient();
  const system = context
    ? `${SYSTEM_PROMPT}\n\nUser's recent diary context:\n${context}`
    : SYSTEM_PROMPT;

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [{ role: "system", content: system }, ...history, { role: "user", content: message }],
  });

  let fullText = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) { onDelta(delta); fullText += delta; }
  }
  return fullText;
}

export async function streamWithSystemPrompt(systemPrompt, history, message, onDelta) {
  const { model } = getConfig();
  const client = getClient();
  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }],
  });

  let fullText = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) { onDelta(delta); fullText += delta; }
  }
  return fullText;
}
