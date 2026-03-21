# DiaryGPT

An AI diary companion. Write entries, get emotional analysis, and have reflective conversations powered by real RAG — the AI retrieves the most *relevant* entries to your question, not just the most recent ones.

Storage runs locally by default (SQLite + sqlite-vec). Switch to PostgreSQL for multi-device sync.

Supports **Anthropic Claude**, **OpenAI GPT**, and **Google Gemini** — switch providers and models at runtime via the config API.

---

## Features

- **AI analysis** — each entry is auto-analyzed for mood, themes, and a follow-up reflection
- **RAG-powered chat** — embeds your question, finds the top-5 most semantically relevant diary chunks via cosine similarity, and uses them as exclusive context
- **Semantic search** — `POST /api/search` finds entries by meaning, not just keywords
- **Hybrid embeddings** — local Ollama (`all-MiniLM-L6-v2`, 384 dims) by default; OpenAI `text-embedding-3-small` (1536 dims) optional
- **Dual storage** — SQLite locally (default) or PostgreSQL for cloud sync; swap via `STORAGE_MODE` env var
- **Multi-provider LLM** — Claude / GPT / Gemini, switch at runtime with no restart

---

## Architecture

```
REST + SSE Client
      ↕
Express API Gateway
    ├── /api/diary    → CRUD + async analysis & embedding
    ├── /api/chat     → RAG retrieval + LLM streaming
    ├── /api/search   → semantic search across entries
    └── /api/config   → switch provider / model

Service Layer
    ├── LLM service        → Claude / OpenAI / Gemini abstraction
    ├── Embedding service  → Ollama (local) or OpenAI API
    └── Storage adapter    → unified interface, routes to SQLite or PostgreSQL

Storage Backends
    ├── SQLite  + sqlite-vec  (local default)
    └── PostgreSQL + pgvector  (cloud / multi-device)
```

---

## Project Structure

```
DiaryGPT/
├── index.js
├── routes/
│   ├── diary.js              # CRUD — triggers analysis & embedding async
│   ├── chat.js               # RAG retrieval + LLM streaming (SSE)
│   ├── search.js             # Semantic search
│   └── config.js             # Provider / model config
├── services/
│   ├── llm.js                # Provider factory
│   ├── embedding.js          # Embedding generation (Ollama or OpenAI)
│   ├── prompts.js            # System prompts + guardrails
│   └── providers/
│       ├── anthropic.js      # Claude (adaptive thinking ON)
│       ├── openai.js         # GPT (streaming + json_object)
│       └── gemini.js         # Gemini (stream + json mime)
├── db/
│   ├── adapter.js            # Routes to SQLite or PostgreSQL via STORAGE_MODE
│   ├── helpers.js            # Re-exports CRUD helpers from active adapter
│   ├── seed.js               # Seeds default user for single-user mode
│   ├── sqlite-schema.sql     # SQLite schema (sqlite-vec)
│   ├── schema.sql            # PostgreSQL schema (pgvector)
│   ├── init.js               # Database initialiser script
│   ├── adapters/
│   │   ├── sqlite.js         # SQLite adapter — ? params, vec_distance_cosine
│   │   └── postgres.js       # pg adapter — $N params, pgvector <=> search
│   └── models/
│       ├── entries.js
│       ├── embeddings.js     # insert + cosine similarity search
│       ├── analysis.js
│       ├── chatSessions.js
│       ├── chatMessages.js
│       └── config.js
└── storage/
    └── configStore.js        # LLM provider config (JSON file)
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

```env
# Storage — 'local' (SQLite, default) or 'cloud' (PostgreSQL)
STORAGE_MODE=local

# Embedding provider — 'ollama' (default, local) or 'openai'
EMBEDDING_PROVIDER=ollama

# PostgreSQL (cloud mode only)
# DATABASE_URL=postgresql://user:password@localhost:5432/diarygpt

# LLM providers — only the ones you use need keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

PORT=3000
```

### 3. Set up embeddings

**Ollama (local, no API cost — default):**
```bash
ollama pull all-MiniLM-L6-v2
```

**OpenAI (API):**
```env
EMBEDDING_PROVIDER=openai
# OPENAI_API_KEY is already set above
```

### 4. Start the server

```bash
npm run dev     # development — auto-restarts on file changes
npm start       # production
```

Server runs at `http://localhost:3000`. The SQLite database and default user are created automatically on first start.

---

## How RAG Works

```
User message: "What patterns do you notice in my stress?"
      ↓
generateEmbedding(message)  →  [0.12, -0.34, 0.91, ...]
      ↓
vectorSearch(queryVec, k=5, threshold=0.3)
      ↓
Top-5 most RELEVANT diary chunks (by cosine similarity)
      ↓
Injected as exclusive context into the LLM prompt
      ↓
AI responds grounded in your actual entries — no hallucination
```

On entry creation, the body is embedded in the background (non-blocking). Both Ollama and OpenAI embeddings are stored as Float32 BLOBs in SQLite (or VECTOR columns in PostgreSQL) and searched with cosine similarity.

---

## API Reference

### Diary Entries

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/diary` | List all entries |
| `GET` | `/api/diary/:id` | Get a single entry |
| `POST` | `/api/diary` | Create entry — triggers async analysis & embedding |
| `PATCH` | `/api/diary/:id` | Update entry |
| `DELETE` | `/api/diary/:id` | Delete entry + its embeddings |

**Create an entry**
```bash
curl -X POST http://localhost:3000/api/diary \
  -H "Content-Type: application/json" \
  -d '{ "title": "Monday", "body": "Rough day at work but the evening walk helped.", "writtenAt": "2026-03-21" }'
```

Response includes AI analysis:
```json
{
  "id": "uuid",
  "title": "Monday",
  "body": "Rough day at work but the evening walk helped.",
  "analysis": {
    "mood": "mixed",
    "themes": ["work stress", "self-care", "recovery"],
    "reflection": "It sounds like you navigated a tough day with a lot of self-awareness...",
    "followUpQuestion": "What made the walk feel restorative for you?"
  },
  "writtenAt": "2026-03-21T00:00:00.000Z"
}
```

---

### Chat (RAG-powered)

**`POST /api/chat`** — streams a response via Server-Sent Events.

The AI embeds your message, retrieves the top-5 most relevant entry chunks via cosine similarity, decrypts them in memory, and uses them as exclusive context. It will not invent entries or use general knowledge.

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{ "message": "What patterns do you notice in how I handle stress?" }'
```

**SSE response format:**
```
data: {"delta": "Looking at your entries, "}
data: {"delta": "I notice a pattern of..."}
data: {"done": true, "text": "Looking at your entries, I notice a pattern of..."}
```

---

### Semantic Search

**`POST /api/search`** — find entries by meaning.

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{ "query": "times I felt anxious before a big decision" }'
```

Response:
```json
[
  { "id": "uuid", "title": "Sunday", "body": "...", "writtenAt": "...", "score": 0.87 },
  { "id": "uuid", "title": "Thursday", "body": "...", "writtenAt": "...", "score": 0.74 }
]
```

---

### Config

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | Get active provider/model + all available options |
| `POST` | `/api/config` | Switch provider, model, or set API key |

**Switch to OpenAI**
```bash
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{ "provider": "openai", "model": "gpt-4o" }'
```

---

## Available Models

| Provider | Models | Default |
|---|---|---|
| `anthropic` | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5` | `claude-opus-4-6` |
| `openai` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` | — |
| `gemini` | `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash` | — |

---

## Embedding Models

| Mode | Model | Dimensions |
|---|---|---|
| Local (Ollama) | `all-MiniLM-L6-v2` | 384 |
| API (OpenAI) | `text-embedding-3-small` | 1536 |

Default: **Ollama local** — no data leaves the machine. Switching embedding models requires re-embedding all entries (delete and recreate them, or run a migration script).

---

## Adding a New LLM Provider

1. Create `services/providers/yourprovider.js`:
   ```js
   export async function analyzeEntry(text) { ... }
   export async function streamChat(history, message, context, onDelta) { ... }
   ```
2. Register it in `services/llm.js` and `storage/configStore.js` (`PROVIDER_MODELS`).
