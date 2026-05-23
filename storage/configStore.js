// Stores the active LLM provider configuration
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "../data/config.json");

const DEFAULTS = {
  provider: "ollama",
  model: "llama3.2",
  apiKey: null,
};

export const PROVIDER_MODELS = {
  // Local — zero data leaves the machine
  ollama: ["llama3.2", "llama3.1:8b", "mistral:7b", "qwen2.5:7b", "phi4:14b"],
  // Cloud — user opt-in, bring your own key
  anthropic: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
  openai:    ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  gemini:    ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro"],
  groq:      ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
};

// Privacy tier for each provider
export const PROVIDER_PRIVACY = {
  ollama:    "local",
  anthropic: "cloud",
  openai:    "cloud",
  gemini:    "cloud",
  groq:      "cloud",
  mistral:   "cloud",
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

  // Cloud providers require an API key (env var or stored key)
  if (PROVIDER_PRIVACY[next.provider] === "cloud" && !next.apiKey) {
    const envKeys = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai:    process.env.OPENAI_API_KEY,
      gemini:    process.env.GEMINI_API_KEY,
      groq:      process.env.GROQ_API_KEY,
      mistral:   process.env.MISTRAL_API_KEY,
    };
    if (!envKeys[next.provider]) {
      throw new Error(`Provider "${next.provider}" requires an API key. Set it in your .env or enter it in Settings.`);
    }
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}
