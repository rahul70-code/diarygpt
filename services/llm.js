// Provider factory — delegates to the active provider from config
import { getConfig } from "../storage/configStore.js";
import * as anthropic from "./providers/anthropic.js";
import * as openai from "./providers/openai.js";
import * as gemini from "./providers/gemini.js";

const PROVIDERS = { anthropic, openai, gemini };

function getProvider() {
  const { provider } = getConfig();
  const p = PROVIDERS[provider];
  if (!p) throw new Error(`Unknown provider: "${provider}"`);
  return p;
}

export const analyzeEntry = (text) => getProvider().analyzeEntry(text);
export const streamChat = (history, message, context, onDelta) =>
  getProvider().streamChat(history, message, context, onDelta);
