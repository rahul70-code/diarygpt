/**
 * Embedding service — generates text embeddings for RAG.
 *
 * EMBEDDING_PROVIDER env var controls the backend:
 *   'jina'   (default) — Jina AI jina-embeddings-v3 (1024 dims), 1M tokens/month free
 *   'gemini'           — Google text-embedding-004 (768 dims)
 *   'ollama'           — local Ollama, model nomic-embed-text (768 dims)
 *   'openai'           — OpenAI text-embedding-3-small (1536 dims)
 */
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PROVIDER = process.env.EMBEDDING_PROVIDER || "ollama";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = "nomic-embed-text";
const OPENAI_MODEL = "text-embedding-3-small";
const GEMINI_EMBED_MODEL = "text-embedding-004";

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
  if (PROVIDER === "ollama") return _embedOllama(text);
  if (PROVIDER === "gemini") return _embedGemini(text);
  return _embedJina(text);
}

async function _embedJina(text) {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error("JINA_API_KEY is not set");
  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "jina-embeddings-v3", input: [text] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Jina embedding failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

async function _embedGemini(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_EMBED_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function _embedOllama(text) {
  let res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, input: text }),
  });

  if (res.ok) {
    const data = await res.json();
    if (data.embeddings?.[0]) return data.embeddings[0];
  }

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
