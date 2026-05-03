import OpenAI from "openai";
import { getConfig } from "../../storage/configStore.js";
import { SYSTEM_PROMPT, ANALYZE_PROMPT } from "../prompts.js";

function getClient() {
  const { apiKey } = getConfig();
  return new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
}

export async function analyzeEntry(text) {
  const { model } = getConfig();
  const client = getClient();

  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: ANALYZE_PROMPT(text) },
    ],
  });

  return JSON.parse(response.choices[0].message.content ?? "{}");
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
    messages: [
      { role: "system", content: system },
      ...history,
      { role: "user", content: message },
    ],
  });

  let fullText = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      onDelta(delta);
      fullText += delta;
    }
  }
  return fullText;
}
