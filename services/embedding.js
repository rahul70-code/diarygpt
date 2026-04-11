/**
 * Embedding service — generates text embeddings for RAG.
 *
 * EMBEDDING_PROVIDER env var controls the backend:
 *   'ollama'  (default) — local Ollama, model all-MiniLM-L6-v2 (384 dims)
 *   'openai'            — OpenAI text-embedding-3-small (1536 dims)
 */
import OpenAI from "openai";

const PROVIDER = process.env.EMBEDDING_PROVIDER || "ollama";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = "nomic-embed-text";
const OPENAI_MODEL = "text-embedding-3-small";

let _openaiClient = null;
function getOpenAIClient() {
  if (!_openaiClient) _openaiClient = new OpenAI();
  return _openaiClient;
}

/**
 * Generate a text embedding vector.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function generateEmbedding(text) {
  if (PROVIDER === "openai") return _embedOpenAI(text);
  return _embedOllama(text);
}

async function _embedOllama(text) {
  // Try the newer /api/embed endpoint first (Ollama >= 0.1.26)
  let res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, input: text }),
  });

  if (res.ok) {
    const data = await res.json();
    // /api/embed returns { embeddings: [[...]] }
    if (data.embeddings?.[0]) return data.embeddings[0];
  }

  // Fall back to the legacy /api/embeddings endpoint
  res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama embedding failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  if (!data.embedding) throw new Error(`Ollama returned no embedding. Is model "${OLLAMA_MODEL}" pulled?`);
  return data.embedding;
}

async function _embedOpenAI(text) {
  const client = getOpenAIClient();
  const res = await client.embeddings.create({
    model: OPENAI_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}
