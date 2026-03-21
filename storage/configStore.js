// Stores the active LLM provider configuration
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "../data/config.json");

const DEFAULTS = {
  provider: "anthropic",
  model: "claude-opus-4-6",
  apiKey: null, // null = fall back to env var
};

export const PROVIDER_MODELS = {
  anthropic: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
};

export function getConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS };
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) };
}

export function setConfig(updates) {
  const current = getConfig();
  const next = { ...current, ...updates };

  if (!PROVIDER_MODELS[next.provider]) {
    throw new Error(`Unknown provider: ${next.provider}`);
  }
  if (!PROVIDER_MODELS[next.provider].includes(next.model)) {
    throw new Error(
      `Model "${next.model}" is not valid for provider "${next.provider}". ` +
        `Valid models: ${PROVIDER_MODELS[next.provider].join(", ")}`
    );
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}
