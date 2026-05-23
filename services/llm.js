// Dynamic LLM routing — reads provider from configStore on every call
import { getConfig } from "../storage/configStore.js";
import * as ollama    from "./providers/ollama.js";
import * as anthropic from "./providers/anthropic.js";
import * as openai    from "./providers/openai.js";
import * as gemini    from "./providers/gemini.js";
import * as groq      from "./providers/groq.js";
import * as mistral   from "./providers/mistral.js";

const PROVIDERS = { ollama, anthropic, openai, gemini, groq, mistral };

function provider() {
  const { provider } = getConfig();
  const p = PROVIDERS[provider];
  if (!p) throw new Error(`Unknown LLM provider: "${provider}". Valid: ${Object.keys(PROVIDERS).join(", ")}`);
  return p;
}

export const analyzeEntry = (text) =>
  provider().analyzeEntry(text);

export const generateText = (systemPrompt, userMessage) =>
  provider().generateText(systemPrompt, userMessage);

export const streamChat = (history, message, context, onDelta) =>
  provider().streamChat(history, message, context, onDelta);

export const streamWithSystemPrompt = (systemPrompt, history, message, onDelta) =>
  provider().streamWithSystemPrompt(systemPrompt, history, message, onDelta);
