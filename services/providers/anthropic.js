import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../../storage/configStore.js";
import { SYSTEM_PROMPT, ANALYZE_PROMPT } from "../prompts.js";

function getClient() {
  const { apiKey } = getConfig();
  return new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
}

export async function analyzeEntry(text) {
  const { model } = getConfig();
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: ANALYZE_PROMPT(text) }],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "{}";
  return JSON.parse(raw);
}

export async function generateText(systemPrompt, userMessage) {
  const { model } = getConfig();
  const client = getClient();
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  return response.content.find((b) => b.type === "text")?.text ?? "";
}

export async function streamWithSystemPrompt(systemPrompt, history, message, onDelta) {
  const { model } = getConfig();
  const client = getClient();
  const stream = client.messages.stream({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [...history, { role: "user", content: message }],
  });
  stream.on("text", onDelta);
  const final = await stream.finalMessage();
  return final.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

export async function streamChat(history, message, context, onDelta) {
  const { model } = getConfig();
  const client = getClient();

  const system = context
    ? `${SYSTEM_PROMPT}\n\nUser's recent diary context:\n${context}`
    : SYSTEM_PROMPT;

  const stream = client.messages.stream({
    model,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system,
    messages: [...history, { role: "user", content: message }],
  });

  stream.on("text", onDelta);
  const final = await stream.finalMessage();
  return final.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}
