# DiaryGPT

A privacy-first AI diary companion. Write entries, get emotional analysis, and have reflective conversations powered by RAG — the AI only knows what you've written, nothing else.

All entry text is **AES-256 encrypted at rest**. Storage runs locally by default (SQLite); switch to PostgreSQL for multi-device sync.

Supports **Anthropic Claude**, **OpenAI GPT**, and **Google Gemini** — switch providers and models at runtime via the config API.

---

## Features

- **Encrypted diary entries** — title, body, and AI reflections are AES-256 encrypted at rest
- **AI analysis** — each entry is auto-analyzed for mood, themes, and a follow-up reflection
- **RAG-powered chat** — multi-turn conversations grounded in your diary entries; no hallucination, no external knowledge
- **Semantic search** — find entries by meaning, not just keywords
- **Hybrid embeddings** — local Ollama (all-MiniLM-L6-v2) by default; OpenAI API optional
- **Dual storage** — SQLite locally (max privacy) or PostgreSQL for cloud sync; swap via config
- **Multi-provider LLM** — Claude / GPT / Gemini, switch at runtime with no restart

---

## Architecture

```
Client (React SPA)
    ↕ REST + SSE
Express API Gateway
    ├── /api/diary    → CRUD + async analysis & embedding
    ├── /api/chat     → RAG retrieval + LLM streaming
    ├── /api/search   → semantic search across entries
    └── /api/config   → switch provider / model / storage

Service Layer
    ├── LLM service        → Claude / OpenAI / Gemini abstraction
    ├── Embedding service  → Ollama (local) or OpenAI API
    ├── Encryption service → AES-256-GCM, key from user passphrase
    └── Storage adapter    → unified interface, routes to SQLite or PostgreSQL

Storage Backends
    ├── SQLite  + sqlite-vec  (local default, max privacy)
    └── PostgreSQL + pgvector  (cloud, multi-device sync)
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
│   └── config.js             # Provider / model / storage config
├── services/
│   ├── llm.js                # Provider factory
│   ├── prompts.js            # System prompts + guardrails
│   └── providers/
│       ├── anthropic.js      # Claude (adaptive thinking ON)
│       ├── openai.js         # GPT (streaming + json_object)
│       └── gemini.js         # Gemini (stream + json mime)
├── db/
│   ├── connection.js         # pg.Pool singleton (PostgreSQL)
│   ├── adapter.js            # Routes to SQLite or PostgreSQL via STORAGE_MODE
│   ├── helpers.js            # Re-exports CRUD helpers from active adapter
│   ├── schema.sql            # PostgreSQL schema (pgvector)
│   ├── sqlite-schema.sql     # SQLite schema (sqlite-vec)
│   ├── init.js               # Database initialiser script
│   ├── adapters/
│   │   ├── postgres.js       # pg adapter — $N params, pgvector <=> search
│   │   └── sqlite.js         # SQLite adapter — ? params, vec_distance_cosine
│   └── models/
│       ├── users.js
│       ├── entries.js
│       ├── embeddings.js     # insert + cosine similarity search
│       ├── analysis.js
│       ├── chatSessions.js
│       ├── chatMessages.js
│       └── config.js
├── storage/
│   └── configStore.js        # LLM provider config (JSON file)
└── data/                     # Auto-created, gitignored
    └── diary.db              # SQLite database (local mode)
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

# SQLite path (local mode only — defaults to ./data/diary.db)
# SQLITE_PATH=./data/diary.db

# PostgreSQL (cloud mode only)
# DATABASE_URL=postgresql://user:password@localhost:5432/dairygpt

# LLM providers — only the ones you use need keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Embedding (required when embedding_provider = 'openai')
# OPENAI_API_KEY already covers this

PORT=3000
```

### 3. Initialise the database

```bash
npm run db:init
```

- **Local (SQLite):** schema is applied automatically, `data/diary.db` is created.
- **Cloud (PostgreSQL):** the command prints the `psql` instruction to run. PostgreSQL needs the `pgvector` extension available.

### 4. Start the server

```bash
npm run dev     # development — auto-restarts on file changes
npm start       # production
```

Server runs at `http://localhost:3000`.

---

## Database Schema

All tables run on both backends. The storage adapter handles dialect differences.
Fields ending in `_encrypted` are AES-256 encrypted at rest.

| Table | Key columns |
|---|---|
| `users` | `id`, `email`, `encryption_key_hash` (Argon2), `storage_mode`, `embedding_provider` |
| `entries` | `id`, `user_id` (FK), `title_encrypted`, `body_encrypted`, `content_hash` (SHA-256), `written_at` |
| `embeddings` | `id`, `entry_id` (FK), `embedding` (VECTOR/BLOB), `model_used`, `chunk_text_encrypted`, `chunk_index` |
| `analysis` | `id`, `entry_id` (FK), `mood`, `themes`, `reflection_encrypted`, `follow_up_question` |
| `chat_sessions` | `id`, `user_id` (FK), `title` |
| `chat_messages` | `id`, `session_id` (FK), `role`, `content_encrypted`, `context_entry_ids` (RAG traceability) |
| `app_config` | `key` (singleton), `provider`, `model`, `api_key` |

**Privacy note:** vectors are stored unencrypted (cosine similarity cannot operate on ciphertext). Vectors alone cannot reconstruct diary text — the chunk text is always encrypted.

---

## Storage Adapter

`db/adapter.js` reads `STORAGE_MODE` from the environment and exports a unified API regardless of backend.

| Function | Description |
|---|---|
| `query(sql, params)` | Raw parameterised query |
| `getOne(table, conditions)` | SELECT … LIMIT 1, returns row or `null` |
| `getMany(table, conditions, options)` | SELECT with optional `orderBy / limit / offset` |
| `insert(table, data)` | INSERT … RETURNING \* |
| `update(table, data, conditions)` | UPDATE … RETURNING \* |
| `upsert(table, data, conflictCols)` | INSERT … ON CONFLICT DO UPDATE RETURNING \* |
| `remove(table, conditions)` | DELETE … RETURNING \* |
| `insertEmbedding(data)` | Insert chunk + vector (backend-specific format) |
| `vectorSearch(userId, vector, opts)` | Cosine similarity search (pgvector or sqlite-vec) |

Backend differences are fully contained in the two adapter files — models and routes never import from them directly.

---

## API Reference

### Diary Entries

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/diary` | List all entries |
| `GET` | `/api/diary/:id` | Get a single entry |
| `POST` | `/api/diary` | Create entry — triggers async analysis & embedding |
| `PATCH` | `/api/diary/:id` | Update entry |
| `DELETE` | `/api/diary/:id` | Delete entry |

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
  "titleEncrypted": "...",
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

The AI retrieves the top 5 most relevant entry chunks via cosine similarity, decrypts them in memory, and uses them as exclusive context. It will not invent entries or use general knowledge.

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "uuid", "message": "What patterns do you notice in how I handle stress?" }'
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

---

### Config

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | Get active provider/model + all available options |
| `POST` | `/api/config` | Switch provider, model, storage mode, or set API key |

**Check current config**
```bash
curl http://localhost:3000/api/config
```
```json
{
  "active": { "provider": "anthropic", "model": "claude-sonnet-4-6", "hasCustomKey": false },
  "available": {
    "anthropic": ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
    "openai": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    "gemini": ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"]
  }
}
```

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
| `anthropic` | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5` | `claude-sonnet-4-6` |
| `openai` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` | — |
| `gemini` | `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash` | — |

---

## Embedding Models

| Mode | Model | Dimensions |
|---|---|---|
| Local (Ollama) | `all-MiniLM-L6-v2` | 384 |
| API (OpenAI) | `text-embedding-3-small` | 1536 |

Default: **Ollama local** — no data leaves the machine. Switching embedding models requires re-embedding all entries.

---

## Adding a New LLM Provider

1. Create `services/providers/yourprovider.js`:
   ```js
   export async function analyzeEntry(text) { ... }
   export async function streamChat(history, message, context, onDelta) { ... }
   ```
2. Register it in `services/llm.js` and `storage/configStore.js` (`PROVIDER_MODELS`).
