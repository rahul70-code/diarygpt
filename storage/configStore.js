import { AsyncLocalStorage } from "async_hooks";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getOne } from "../db/helpers.js";
import { encrypt, decrypt } from "../services/encryption.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "../data/config.json");

const isPg = (process.env.STORAGE_MODE || "local") === "cloud";
const als  = new AsyncLocalStorage();

const DEFAULTS = {
  provider: "ollama",
  model:    "llama3.2",
  apiKey:   null,
};

export const PROVIDER_MODELS = {
  ollama:    ["llama3.2", "llama3.1:8b", "mistral:7b", "qwen2.5:7b", "phi4:14b"],
  anthropic: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
  openai:    ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  gemini:    ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro"],
  groq:      ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  mistral:   ["mistral-large-latest", "mistral-small-latest", "open-mixtral-8x22b"],
};

export const PROVIDER_PRIVACY = {
  ollama:    "local",
  anthropic: "cloud",
  openai:    "cloud",
  gemini:    "cloud",
  groq:      "cloud",
  mistral:   "cloud",
};

function readFile() {
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS };
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) };
}

function rowToConfig(row) {
  return {
    provider: row.provider ?? DEFAULTS.provider,
    model:    row.model    ?? DEFAULTS.model,
    apiKey:   row.api_key  ? decrypt(row.api_key) : null,
  };
}

// Fallback chain: user row → 'default' singleton row → config file → hardcoded DEFAULTS
async function loadUserConfig(userId) {
  try {
    const userRow = await getOne("app_config", { key: userId });
    if (userRow) return rowToConfig(userRow);

    const defaultRow = await getOne("app_config", { key: "default" });
    if (defaultRow) return rowToConfig(defaultRow);
  } catch {
    // DB unavailable (e.g. startup race) — fall through
  }
  return readFile();
}

// Adapter-aware raw upsert — avoids the generic upsert() which auto-injects an `id`
// column that app_config does not have.
async function upsertConfig(key, provider, model, apiKey, updatedAt) {
  const mod = isPg
    ? await import("../db/adapters/postgres.js")
    : await import("../db/adapters/sqlite.js");

  if (isPg) {
    await mod.query(
      `INSERT INTO app_config (key, provider, model, api_key, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO UPDATE SET
         provider   = EXCLUDED.provider,
         model      = EXCLUDED.model,
         api_key    = EXCLUDED.api_key,
         updated_at = EXCLUDED.updated_at`,
      [key, provider, model, apiKey, updatedAt]
    );
  } else {
    await mod.query(
      `INSERT INTO app_config (key, provider, model, api_key, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET
         provider   = excluded.provider,
         model      = excluded.model,
         api_key    = excluded.api_key,
         updated_at = excluded.updated_at`,
      [key, provider, model, apiKey, updatedAt]
    );
  }
}

/** Returns the active config for the current request context, or file-based defaults. */
export function getConfig() {
  return als.getStore() ?? readFile();
}

/**
 * Express middleware — loads the user's config from DB and binds it to the
 * AsyncLocalStorage context so all downstream calls to getConfig() see it.
 * Must run after authMiddleware (requires req.user.id).
 */
export async function userConfigMiddleware(req, _res, next) {
  const config = await loadUserConfig(req.user.id).catch(() => ({ ...DEFAULTS }));
  als.run(config, next);
}

function validate(config) {
  if (!PROVIDER_MODELS[config.provider]) {
    throw new Error(`Unknown provider: ${config.provider}`);
  }
  if (!PROVIDER_MODELS[config.provider].includes(config.model)) {
    throw new Error(
      `Model "${config.model}" is not valid for provider "${config.provider}". ` +
        `Valid models: ${PROVIDER_MODELS[config.provider].join(", ")}`
    );
  }
  if (PROVIDER_PRIVACY[config.provider] === "cloud" && !config.apiKey) {
    const envKeys = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai:    process.env.OPENAI_API_KEY,
      gemini:    process.env.GEMINI_API_KEY,
      groq:      process.env.GROQ_API_KEY,
      mistral:   process.env.MISTRAL_API_KEY,
    };
    if (!envKeys[config.provider]) {
      throw new Error(
        `Provider "${config.provider}" requires an API key. Set it in your .env or enter it in Settings.`
      );
    }
  }
}

/** Save updated config for a specific user and refresh the current request context. */
export async function setUserConfig(userId, updates) {
  const current = await loadUserConfig(userId);
  const next = { ...current, ...updates };

  validate(next);

  await upsertConfig(
    userId,
    next.provider,
    next.model,
    next.apiKey ? encrypt(next.apiKey) : null,
    new Date().toISOString()
  );

  // Reflect the change in the current request's ALS store immediately
  const store = als.getStore();
  if (store) Object.assign(store, { provider: next.provider, model: next.model, apiKey: next.apiKey });

  return next;
}

/** @deprecated Use setUserConfig(userId, updates) for user-scoped changes. */
export function setConfig(updates) {
  const current = readFile();
  const next = { ...current, ...updates };
  validate(next);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}
