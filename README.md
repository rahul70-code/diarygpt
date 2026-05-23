# DairyGPT

An AI-powered personal journal with voice, emotional insights, therapy, and memory across time.

Write entries by typing or speaking. The AI analyzes your mood, surfaces patterns across months of writing, generates personalized prompts, and holds reflective conversations grounded in your actual diary — not generic advice.

**Runs entirely on your machine by default.** Ollama powers both embeddings and chat locally — zero data leaves your device. Cloud providers (Groq, OpenAI, Anthropic, Gemini) are available as an opt-in with your own API key.

---

## Privacy Model

DairyGPT has two modes, switchable at runtime from **⚙️ Settings**:

| | 🟢 Local Mode (default) | 🟡 Cloud Mode (opt-in) |
|---|---|---|
| **LLM** | Ollama on your machine | Groq / OpenAI / Anthropic / Gemini |
| **Embeddings** | Ollama `nomic-embed-text` | Ollama (stays local even in cloud mode) |
| **Vector search** | SQLite-vec / pgvector — on your server | SQLite-vec / pgvector — on your server |
| **Data sent externally** | Nothing | Top 5 diary excerpts per chat message |
| **API key required** | No | Yes — your own key, stored locally |

Embeddings and cosine similarity **always** run locally regardless of mode. In cloud mode, only the most relevant diary excerpts transit to the provider — never your full diary.

---

## Features

| Feature | How it works |
|---|---|
| **Multi-user auth** | JWT + Argon2id password hashing. Every user's data is isolated. |
| **Web UI** | Vanilla JS SPA served by Express — no build step, works out of the box |
| **AI mood analysis** | Every entry analyzed for mood, themes, a reflection, and a follow-up question |
| **RAG-powered chat** | Embeds your question, finds the 5 most semantically relevant diary chunks via cosine similarity, grounds the AI response in your actual entries |
| **Persistent chat sessions** | Conversations saved to DB, resumable across page refreshes |
| **Semantic search** | Find entries by meaning, not keywords — "times I felt lonely" matches "isolated", "disconnected", "blue" |
| **Insights dashboard** | Mood distribution chart, writing streak, "on this day" memories |
| **Weekly reflection** | AI summary of the week's emotional arc and themes |
| **AI journaling prompts** | Personalized suggestions based on patterns in your recent writing |
| **Voice dictation** | Speak a diary entry — browser transcribes it into the text area |
| **Voice chat** | Ask the AI a question out loud, hear the response read back |
| **AI therapy companion** | Structured emotional support using CBT/DBT techniques, with hardcoded crisis detection |
| **Mood check-ins** | 1–10 mood logging before therapy sessions, history chart |
| **Privacy settings** | Switch between fully local (Ollama) and cloud providers at runtime |
| **Encryption at rest** | AES-256-GCM on all diary, chat, and therapy content |
| **Dual storage** | SQLite locally (default) or PostgreSQL for multi-device sync |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Pull Ollama models (local mode — recommended)

```bash
# Chat / analysis model — pick one:
ollama pull llama3.2          # 2GB  — fast, good quality
ollama pull llama3.1:8b       # 5GB  — better quality
ollama pull qwen2.5:7b        # 5GB  — excellent quality for its size

# Embedding model — required for RAG and search:
ollama pull nomic-embed-text
```

Don't have Ollama? Install it from [ollama.com](https://ollama.com) — takes under two minutes.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000

# Required — encrypt all content at rest (64 hex chars = 32 bytes)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_hex_char_key_here

# Required — signs JWT tokens
JWT_SECRET=your_jwt_secret_here

# Storage: 'local' (SQLite, default) or 'cloud' (PostgreSQL)
STORAGE_MODE=local

# Embedding provider: 'ollama' (default, local) or 'openai' / 'jina' / 'gemini'
EMBEDDING_PROVIDER=ollama

# Ollama URL (if not running on default port)
# OLLAMA_URL=http://localhost:11434

# Cloud LLM providers — only needed if you opt into cloud mode via Settings
# GROQ_API_KEY=gsk_...
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GEMINI_API_KEY=AIza...
# MISTRAL_API_KEY=...

# PostgreSQL (cloud storage only)
# DATABASE_URL=postgresql://user:password@localhost:5432/dairygpt
```

### 4. Start

```bash
npm run dev     # development — auto-restarts on changes
npm start       # production
```

Open **http://localhost:3000** — the UI loads automatically.

---

## Using the App

### Register & log in

The first screen is a login/register form. Create an account — all diary data is scoped to your user and encrypted at rest.

### Write an entry

Go to **📓 Diary → + New entry**. Type or click **🎤 Dictate** to speak your entry. The AI analyzes mood and themes in the background.

Use **✨ Suggest a prompt** to get a personalized journaling question based on your recent writing patterns.

### Chat with your journal

Go to **💬 Chat**. Ask anything — "What patterns do you see in my stress?" or "What made me happy last month?" The AI retrieves the most relevant entries via vector search and responds grounded in your actual writing.

Click **🎤** to ask by voice. Click **🔊 Voice on** to hear responses read back.

### Insights

Go to **✨ Insights** for:
- Mood distribution chart (last 30 days)
- Current writing streak
- "On this day…" — entries from the same date in past years
- Weekly reflection — click **Generate summary** for an AI summary of the past 7 days

### Therapy companion

Go to **🧘 Therapy** for structured emotional support. The AI uses CBT thought-reframing, DBT skills, and reflective listening.

- Rate your mood (1–10) at the start of each session
- Sessions are saved and resumable — the AI remembers what you discussed
- Voice input and voice responses work here too

**Important:** A disclosure banner is always visible: *"This is an AI companion, not a licensed therapist."* If crisis language is detected in any message, the LLM is bypassed entirely and hardcoded crisis resources are shown (988 Lifeline, Crisis Text Line, findahelpline.com).

### Semantic search

Go to **🔍 Search**. Search by meaning: "times I felt overwhelmed", "moments of gratitude", "conflicts at work".

### Settings

Go to **⚙️ Settings** to switch between local and cloud mode, pick an AI model, and enter an API key. The privacy badge in the sidebar updates immediately.

---

## How RAG Works

```
WRITE (once per entry)
──────────────────────
Entry text
    → Ollama nomic-embed-text → [0.21, 0.83, ...] (768 numbers)
    → Embedding saved to DB (raw — math requires it)
    → Entry text saved to DB (AES-256-GCM encrypted)
    → LLM analyzes mood/themes async (encrypted result saved)

ASK (every chat message)
────────────────────────
Your question
    → Ollama nomic-embed-text → question vector
    → Cosine similarity against all your entry vectors (runs in DB, locally)
    → Top 5 most relevant entries selected
    → Decrypted in memory → injected into LLM system prompt
    → LLM streams answer grounded in your actual entries
```

Embeddings run async and non-blocking — entries save instantly regardless. Both SQLite (`sqlite-vec`) and PostgreSQL (`pgvector`) handle cosine similarity locally without any external service.

---

## Architecture

```
Browser (Vanilla JS SPA — no build step)
      ↕ fetch + ReadableStream (SSE streaming)
Express API (index.js)
    ├── /api/auth        → register, login (JWT + Argon2id)
    ├── /api/diary       → CRUD + async analysis & embedding
    ├── /api/chat        → sessions, messages, RAG + LLM streaming
    ├── /api/search      → semantic search
    ├── /api/insights    → mood data, weekly summary, journaling prompt
    ├── /api/voice       → Whisper transcription, OpenAI TTS
    ├── /api/therapy     → therapy sessions, crisis gate, mood logs
    └── /api/config      → switch LLM provider / model at runtime

Service Layer
    ├── llm.js           → dynamic provider factory (reads config on every call)
    ├── embedding.js     → Ollama / OpenAI / Jina / Gemini embeddings
    ├── encryption.js    → AES-256-GCM encrypt/decrypt
    ├── prompts.js       → all system prompts
    └── providers/
        ├── ollama.js    → local inference via Ollama OpenAI-compatible API
        ├── groq.js      → Groq (llama-3.3-70b, fastest cloud inference)
        ├── anthropic.js → Claude (adaptive thinking)
        ├── openai.js    → GPT (streaming + JSON mode)
        ├── gemini.js    → Gemini (stream + JSON mime)
        └── mistral.js   → Mistral

Storage
    ├── SQLite  + sqlite-vec  (local default — single file, zero config)
    └── PostgreSQL + pgvector  (cloud / multi-device sync)
```

---

## Project Structure

```
DairyGPT/
├── index.js
├── middleware/
│   └── auth.js               # JWT verification — attaches req.user
├── routes/
│   ├── auth.js               # POST /register, /login
│   ├── diary.js              # CRUD — triggers analysis & embedding async
│   ├── chat.js               # Sessions + RAG streaming (SSE)
│   ├── search.js             # Semantic search
│   ├── insights.js           # Mood dashboard, weekly summary, prompt
│   ├── voice.js              # Whisper transcription, OpenAI TTS
│   ├── therapy.js            # Therapy sessions, crisis gate, mood logs
│   └── config.js             # Provider / model / privacy config
├── services/
│   ├── llm.js                # Dynamic provider factory
│   ├── embedding.js          # Embedding generation (multi-provider)
│   ├── encryption.js         # AES-256-GCM
│   ├── prompts.js            # All system prompts
│   └── providers/
│       ├── ollama.js         # Local — Ollama OpenAI-compatible endpoint
│       ├── groq.js           # Cloud — Groq (llama-3.3-70b)
│       ├── anthropic.js      # Cloud — Claude (adaptive thinking)
│       ├── openai.js         # Cloud — GPT
│       ├── gemini.js         # Cloud — Gemini
│       └── mistral.js        # Cloud — Mistral
├── db/
│   ├── adapter.js            # Routes to SQLite or PostgreSQL
│   ├── helpers.js            # Re-exports CRUD helpers
│   ├── sqlite-schema.sql     # SQLite schema
│   ├── schema.sql            # PostgreSQL schema
│   ├── adapters/
│   │   ├── sqlite.js         # ? placeholders, sqlite-vec cosine search
│   │   └── postgres.js       # $N placeholders, pgvector <=> search
│   └── models/
│       ├── users.js
│       ├── entries.js
│       ├── embeddings.js
│       ├── analysis.js
│       ├── chatSessions.js
│       ├── chatMessages.js
│       ├── therapySessions.js
│       ├── therapyMessages.js
│       ├── moodLogs.js
│       ├── insights.js       # Adapter-aware complex queries (mood, streak, memories)
│       └── config.js
├── public/                   # Frontend SPA (served by Express)
│   ├── index.html
│   ├── style.css
│   └── app.js
└── storage/
    └── configStore.js        # LLM provider + privacy config (JSON file)
```

---

## API Reference

All endpoints except `/api/auth/*` require a JWT token:

```
Authorization: Bearer <token>
```

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | `{ email, password }` | Create account, returns `{ token, user }` |
| `POST` | `/api/auth/login` | `{ email, password }` | Sign in, returns `{ token, user }` |

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{ "email": "you@example.com", "password": "yourpassword" }'
```

---

### Diary Entries

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/diary` | List all entries (newest first) |
| `GET` | `/api/diary/:id` | Get a single entry |
| `POST` | `/api/diary` | Create entry — triggers async mood analysis & embedding |
| `PATCH` | `/api/diary/:id` | Update title, body, or date |
| `DELETE` | `/api/diary/:id` | Delete entry + its embeddings |

```bash
curl -X POST http://localhost:3000/api/diary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "title": "Monday", "body": "Rough day, but the evening walk helped.", "writtenAt": "2026-05-23" }'
```

---

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a message — streams SSE, creates session if needed |
| `GET` | `/api/chat/sessions` | List all chat sessions |
| `GET` | `/api/chat/sessions/:id/messages` | Get all messages in a session |
| `DELETE` | `/api/chat/sessions/:id` | Delete session + messages |

**Request:**
```json
{ "message": "What patterns do you see in my stress?", "sessionId": "optional-uuid" }
```

**SSE stream:**
```
data: {"delta": "Looking at your entries, "}
data: {"delta": "I notice a recurring pattern around..."}
data: {"done": true, "text": "...", "sessionId": "uuid"}
```

Pass the `sessionId` from the `done` event on the next message to continue the conversation.

---

### Semantic Search

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "query": "times I felt anxious before a big decision", "k": 5 }'
```

Response includes `score` (0–1 cosine similarity) for each result.

---

### Insights

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/insights/mood?period=30` | Mood counts, timeline, streak, memories |
| `POST` | `/api/insights/weekly` | AI weekly reflection summary |
| `GET` | `/api/insights/prompt` | Personalized journaling prompt |

**Mood response:**
```json
{
  "period": 30,
  "totalEntries": 18,
  "moodCounts": { "calm": 7, "reflective": 5, "anxious": 4, "happy": 2 },
  "streak": 9,
  "memories": [{ "id": "...", "title": "...", "snippet": "...", "yearsAgo": 1 }]
}
```

---

### Therapy

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/therapy/session` | Start or continue a therapy session (SSE streaming) |
| `GET` | `/api/therapy/sessions` | List past sessions with mood scores |
| `GET` | `/api/therapy/sessions/:id/messages` | Get messages in a session |
| `POST` | `/api/therapy/mood` | Log a mood check-in (score 1–10) |
| `GET` | `/api/therapy/mood/history` | Mood scores over time |

Crisis language is detected server-side before any LLM call. If triggered, a hardcoded safe response is returned — the LLM is never invoked.

---

### Voice

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/voice/transcribe` | `multipart/form-data` with `audio` file → `{ text }` via Whisper |
| `POST` | `/api/voice/speak` | `{ text, voice? }` → MP3 stream via OpenAI TTS |

Requires `OPENAI_API_KEY`. Browser `SpeechRecognition` is used as the free fallback (Chrome/Edge).

Available TTS voices: `alloy`, `echo`, `fable`, `nova` (default), `onyx`, `shimmer`.

---

### Config

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | Active provider, model, privacy tier + all available options |
| `POST` | `/api/config` | Switch provider, model, or set API key |

```bash
# Switch to local Ollama (default)
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "provider": "ollama", "model": "qwen2.5:7b" }'

# Opt into Groq (cloud)
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "provider": "groq", "model": "llama-3.3-70b-versatile", "apiKey": "gsk_..." }'
```

**GET response:**
```json
{
  "active": {
    "provider": "ollama",
    "model": "llama3.2",
    "hasCustomKey": false,
    "privacy": "local"
  },
  "available": { "ollama": [...], "groq": [...], "openai": [...] },
  "privacyTiers": { "ollama": "local", "groq": "cloud", "openai": "cloud" }
}
```

---

## Available LLM Models

| Provider | Privacy | Models |
|---|---|---|
| `ollama` | 🟢 Local | `llama3.2`, `llama3.1:8b`, `mistral:7b`, `qwen2.5:7b`, `phi4:14b` |
| `groq` | 🟡 Cloud | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768` |
| `anthropic` | 🟡 Cloud | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5` |
| `openai` | 🟡 Cloud | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo` |
| `gemini` | 🟡 Cloud | `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-pro` |

Default: `ollama` / `llama3.2`. Switch at runtime via Settings — no restart needed.

---

## Embedding Models

| Provider | Model | Dims | Privacy |
|---|---|---|---|
| `ollama` (default) | `nomic-embed-text` | 768 | 🟢 Local — free, no API key |
| `jina` | `jina-embeddings-v3` | 1024 | 🟡 Cloud — 1M tokens/month free |
| `gemini` | `text-embedding-004` | 768 | 🟡 Cloud — free tier |
| `openai` | `text-embedding-3-small` | 1536 | 🟡 Cloud — ~$0.02 / 1M tokens |

Set via `EMBEDDING_PROVIDER` env var. Switching models requires re-embedding existing entries.

---

## Security

- **Passwords** — hashed with Argon2id before storage, never stored in plaintext
- **JWT tokens** — signed with `JWT_SECRET`, expire after 30 days
- **All user content** — AES-256-GCM encrypted at rest; decrypted only in memory at request time
- **Embeddings** — vectors stored unencrypted (required for cosine similarity); chunk text encrypted separately
- **API keys** — stored in a local JSON file on your server, never transmitted externally
- **Data isolation** — every query is scoped to the authenticated user's ID; no cross-user data access

---

## Adding a New LLM Provider

1. Create `services/providers/yourprovider.js` implementing:

```js
export async function analyzeEntry(text) { ... }
// returns { mood, themes, reflection, followUpQuestion }

export async function generateText(systemPrompt, userMessage) { ... }
// returns string

export async function streamChat(history, message, context, onDelta) { ... }
// calls onDelta(chunk) for each token, returns full string

export async function streamWithSystemPrompt(systemPrompt, history, message, onDelta) { ... }
// same as streamChat but with a custom system prompt
```

2. Import it in `services/llm.js` and add it to the `PROVIDERS` map.
3. Add its models and privacy tier to `storage/configStore.js` (`PROVIDER_MODELS`, `PROVIDER_PRIVACY`).
