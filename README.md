# DairyGPT

An AI-powered personal journal with voice, emotional insights, and memory across time.

Write entries by typing or speaking. The AI analyzes your mood, surfaces patterns across months of writing, generates personalized prompts, and holds reflective conversations grounded in your actual diary — not generic advice.

Runs entirely on your machine (SQLite + local Ollama). Optional cloud sync via PostgreSQL. Supports **Anthropic Claude**, **OpenAI GPT**, and **Google Gemini** — switch at runtime.

---

## What's Inside

| Feature | How it works |
|---|---|
| **Multi-user auth** | JWT + Argon2 password hashing. Every user's data is isolated. |
| **Web UI** | Vanilla JS SPA served by Express — no build step, works out of the box |
| **AI mood analysis** | Every entry is analyzed for mood, themes, and a reflective follow-up question |
| **RAG-powered chat** | Embeds your question, finds the 5 most semantically relevant diary chunks via cosine similarity, grounds the AI response in your actual entries |
| **Persistent chat sessions** | Conversations saved to DB, resumable across page refreshes |
| **Semantic search** | Find entries by meaning, not keywords |
| **Insights dashboard** | Mood distribution chart, writing streak, "on this day" memories |
| **Weekly reflection** | AI summary of the week's emotional arc and themes |
| **AI journaling prompts** | Personalized "what to write about" suggestions based on recent entries |
| **Voice dictation** | Speak a diary entry — browser transcribes it into the text area |
| **Voice chat** | Ask the AI a question out loud, hear the response read back |
| **Encryption at rest** | AES-256-GCM on all diary and chat content |
| **Dual storage** | SQLite locally (default) or PostgreSQL for multi-device sync |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000

# Required: 64 hex chars (32 bytes) — encrypt all diary content at rest
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_hex_char_key_here

# Required: any long random string — signs JWT tokens
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_jwt_secret_here

# Storage — 'local' (SQLite, default) or 'cloud' (PostgreSQL)
STORAGE_MODE=local

# Embedding provider — 'ollama' (local, default) or 'openai'
EMBEDDING_PROVIDER=ollama

# LLM providers — only the ones you use need keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Cloud mode only
# DATABASE_URL=postgresql://user:password@localhost:5432/dairygpt
```

### 3. Set up embeddings (local mode)

```bash
ollama pull nomic-embed-text
```

Or switch to OpenAI embeddings by setting `EMBEDDING_PROVIDER=openai` (uses `text-embedding-3-small`).

### 4. Start

```bash
npm run dev     # development — auto-restarts
npm start       # production
```

Open **http://localhost:3000** — the UI loads automatically.

---

## Using the App

### Register & log in

The first screen is a login/register form. Create an account — all diary data is scoped to your user and encrypted at rest.

### Write an entry

Go to **📓 Diary → + New entry**. Type or click **🎤 Dictate** to speak your entry. The AI analyzes mood and themes in the background (requires an LLM API key).

Use **✨ Suggest a prompt** to get a personalized journaling question based on your recent writing.

### Chat with your journal

Go to **💬 Chat**. Ask anything — "What patterns do you see in my stress?" or "What made me happy last month?" The AI retrieves the most relevant entries via vector search and responds grounded in your actual writing.

Click **🎤** to ask by voice. Click **🔊 Voice on** to hear responses read back.

### Insights

Go to **✨ Insights** for:
- Mood distribution chart (last 30 days)
- Current writing streak
- "On this day…" — entries from the same date in past years
- Weekly reflection — click **Generate summary** for an AI summary of the past 7 days

### Semantic search

Go to **🔍 Search**. Search by meaning: "times I felt overwhelmed", "moments of gratitude", "conflicts at work".

---

## Voice Features

Voice uses the **browser's built-in Speech APIs** — free, no API key needed.

| Feature | Where | How |
|---|---|---|
| Voice dictation | New/edit entry | Click **🎤 Dictate**, speak, click **⏹ Stop** |
| Voice chat input | Chat | Click the **🎤** button next to Send |
| AI voice response | Chat | Toggle **🔊 Voice on/off** in the chat header |

**Premium voice quality** (requires OpenAI key):

| Endpoint | Description |
|---|---|
| `POST /api/voice/transcribe` | Sends audio blob to Whisper (`whisper-1`) — more accurate, handles accents |
| `POST /api/voice/speak` | Returns MP3 from OpenAI TTS (`tts-1`, voice `nova` by default) — natural voice |

Browser voice works on Chrome and Edge. Firefox has limited `SpeechRecognition` support.

---

## How RAG Works

```
User message → embed → cosine similarity search over all entry chunks
      ↓
Top-5 most semantically relevant diary chunks (not just recent)
      ↓
Decrypted in memory → injected as exclusive context into LLM
      ↓
AI responds grounded in your actual entries — no hallucination
```

Embeddings are generated async when an entry is saved (non-blocking). Both Ollama and OpenAI embeddings are stored as Float32 BLOBs (SQLite) or VECTOR columns (PostgreSQL).

---

## Architecture

```
Browser (Vanilla JS SPA)
      ↕ fetch + EventSource
Express API (index.js)
    ├── /api/auth        → register, login (JWT)
    ├── /api/diary       → CRUD + async analysis & embedding
    ├── /api/chat        → sessions, messages, RAG + LLM streaming
    ├── /api/search      → semantic search
    ├── /api/insights    → mood data, weekly summary, journaling prompt
    ├── /api/voice       → Whisper transcription, OpenAI TTS
    └── /api/config      → switch LLM provider / model

Service Layer
    ├── llm.js           → analyzeEntry, generateText, streamChat
    ├── embedding.js     → Ollama or OpenAI embeddings
    ├── encryption.js    → AES-256-GCM encrypt/decrypt
    └── providers/       → anthropic.js, openai.js, gemini.js

Storage
    ├── SQLite  + sqlite-vec  (local default)
    └── PostgreSQL + pgvector  (cloud / multi-device)
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
│   └── config.js             # Provider / model config
├── services/
│   ├── llm.js                # Provider factory
│   ├── embedding.js          # Embedding generation
│   ├── encryption.js         # AES-256-GCM
│   ├── prompts.js            # System prompts (chat, analysis, weekly, prompt)
│   └── providers/
│       ├── anthropic.js      # Claude (adaptive thinking + generateText)
│       ├── openai.js         # GPT (streaming + json_object + generateText)
│       └── gemini.js         # Gemini (stream + json mime + generateText)
├── db/
│   ├── adapter.js            # Routes to SQLite or PostgreSQL
│   ├── helpers.js            # Re-exports CRUD helpers
│   ├── sqlite-schema.sql     # SQLite schema
│   ├── schema.sql            # PostgreSQL schema
│   ├── adapters/
│   │   ├── sqlite.js         # ? params, vec_distance_cosine
│   │   └── postgres.js       # $N params, pgvector <=> search
│   └── models/
│       ├── users.js
│       ├── entries.js
│       ├── embeddings.js
│       ├── analysis.js
│       ├── chatSessions.js
│       ├── chatMessages.js
│       ├── insights.js       # Adapter-aware complex queries (mood, streak, memories)
│       └── config.js
├── public/                   # Frontend SPA (served by Express)
│   ├── index.html
│   ├── style.css
│   └── app.js
└── storage/
    └── configStore.js        # LLM provider config (JSON file)
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
  -d '{ "title": "Monday", "body": "Rough day, but the evening walk helped.", "writtenAt": "2026-03-21" }'
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

**SSE response stream:**
```
data: {"delta": "Looking at your entries, "}
data: {"delta": "I notice a recurring pattern around..."}
data: {"done": true, "text": "...", "sessionId": "uuid"}
```

The `sessionId` in the `done` event is used to continue the conversation on the next message.

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

### Voice (Premium — requires OpenAI key)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/voice/transcribe` | `multipart/form-data` with `audio` file → `{ text }` via Whisper |
| `POST` | `/api/voice/speak` | `{ text, voice? }` → MP3 stream via OpenAI TTS |

Available TTS voices: `alloy`, `echo`, `fable`, `nova` (default), `onyx`, `shimmer`.

---

### Config

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | Active provider/model + all available options |
| `POST` | `/api/config` | Switch provider, model, or API key |

```bash
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "provider": "openai", "model": "gpt-4o" }'
```

---

## Available Models

| Provider | Models |
|---|---|
| `anthropic` | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5` |
| `openai` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| `gemini` | `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash` |

Default: `claude-sonnet-4-6`. Switch at runtime — no restart needed.

---

## Embedding Models

| Mode | Model | Dims | Cost |
|---|---|---|---|
| Ollama (default) | `nomic-embed-text` | 768 | Free, local |
| OpenAI | `text-embedding-3-small` | 1536 | ~$0.02 / 1M tokens |

Default is Ollama — no data leaves the machine. Switching models requires re-embedding existing entries.

---

## Security

- **Passwords** — hashed with Argon2id before storage
- **JWT tokens** — signed with `JWT_SECRET`, expire after 30 days
- **Diary & chat content** — AES-256-GCM encrypted at rest; decrypted only in memory at request time
- **Embeddings** — vectors are stored unencrypted (required for cosine similarity); chunk text is encrypted separately
- **Data isolation** — all diary and chat queries are scoped to the authenticated user's ID

---

## Adding a New LLM Provider

1. Create `services/providers/yourprovider.js` implementing:
   ```js
   export async function analyzeEntry(text) { ... }        // returns { mood, themes, reflection, followUpQuestion }
   export async function generateText(systemPrompt, msg) { ... } // returns string
   export async function streamChat(history, message, context, onDelta) { ... } // returns full string
   ```
2. Register it in `services/llm.js` and add its models to `storage/configStore.js` (`PROVIDER_MODELS`).
