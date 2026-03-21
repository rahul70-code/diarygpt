# DairyGPT

An AI-powered diary and journal companion. Write entries, get emotional analysis, and have reflective conversations with an AI that remembers your recent journal history.

Supports **Anthropic Claude**, **OpenAI GPT**, and **Google Gemini** — switch providers and models at runtime via the config API.

---

## Features

- **Write diary entries** — each entry is auto-analyzed for mood, themes, and a reflective response
- **AI chat** — multi-turn conversation streamed in real-time, with your recent entries injected as context
- **Multi-provider** — bring your own API key for Anthropic, OpenAI, or Gemini
- **Switch models at runtime** — no restart needed, config persists to disk

---

## Project Structure

```
DairyGPT/
├── index.js                    # Express app entry point
├── routes/
│   ├── diary.js                # CRUD for diary entries
│   ├── chat.js                 # Streaming chat (SSE)
│   └── config.js               # Provider/model config
├── services/
│   ├── llm.js                  # Provider factory
│   ├── prompts.js              # Shared system & analysis prompts
│   └── providers/
│       ├── anthropic.js        # Claude (adaptive thinking)
│       ├── openai.js           # GPT (json_object + streaming)
│       └── gemini.js           # Gemini (json mime + stream)
├── db/
│   ├── connection.js           # pg.Pool singleton (reads DATABASE_URL)
│   ├── helpers.js              # Generic query wrappers (insert, getOne, getMany, update, upsert, remove)
│   ├── schema.sql              # DDL — run once to initialise tables
│   └── models/
│       ├── entries.js          # Entries model
│       └── config.js           # App config model (singleton row)
├── storage/
│   ├── entriesStore.js         # JSON file-based entry persistence (legacy)
│   └── configStore.js          # Active provider config persistence (legacy)
└── data/                       # Auto-created, gitignored
    ├── entries.json
    └── config.json
```

---

## Setup

**1. Install dependencies**
```bash
npm install
```

**2. Configure environment**
```bash
cp .env.example .env
```

Fill in the values:
```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/dairygpt
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

**3. Initialise the database**

Create the database, then run the schema file:
```bash
createdb dairygpt
psql $DATABASE_URL -f db/schema.sql
```

**4. Start the server**
```bash
npm run dev       # development (auto-restarts on file changes)
npm start         # production
```

Server runs at `http://localhost:3000`.

---

## API Reference

### Diary Entries

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/diary` | List all entries |
| `GET` | `/api/diary/:id` | Get a single entry |
| `POST` | `/api/diary` | Create entry (auto-analyzed by AI) |
| `PATCH` | `/api/diary/:id` | Update entry fields |
| `DELETE` | `/api/diary/:id` | Delete entry |

**Create an entry**
```bash
curl -X POST http://localhost:3000/api/diary \
  -H "Content-Type: application/json" \
  -d '{ "title": "Monday", "body": "Had a rough day at work but the evening walk helped." }'
```

Response includes AI analysis:
```json
{
  "id": "uuid",
  "title": "Monday",
  "body": "Had a rough day at work but the evening walk helped.",
  "analysis": {
    "mood": "mixed",
    "themes": ["work stress", "self-care", "recovery"],
    "reflection": "It sounds like you navigated a tough day with a lot of self-awareness...",
    "followUpQuestion": "What made the walk feel restorative for you?"
  },
  "createdAt": "2026-03-21T10:00:00.000Z"
}
```

---

### Chat

**`POST /api/chat`** — streams a response via Server-Sent Events.

Your 5 most recent diary entries are automatically injected as context.

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{ "message": "What patterns do you notice in my recent entries?" }'
```

**With conversation history:**
```json
{
  "message": "Tell me more about that.",
  "history": [
    { "role": "user", "content": "What patterns do you notice?" },
    { "role": "assistant", "content": "I notice a recurring theme of..." }
  ]
}
```

**SSE response format:**
```
data: {"delta": "I notice "}
data: {"delta": "a pattern of..."}
data: {"done": true, "text": "I notice a pattern of..."}
```

---

### Config

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/config` | Get active provider/model + all available options |
| `POST` | `/api/config` | Switch provider, model, or set a custom API key |

**Check current config**
```bash
curl http://localhost:3000/api/config
```
```json
{
  "active": { "provider": "anthropic", "model": "claude-opus-4-6", "hasCustomKey": false },
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
  -d '{ "provider": "openai", "model": "gpt-4o", "apiKey": "sk-..." }'
```

**Switch to Gemini**
```bash
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{ "provider": "gemini", "model": "gemini-2.0-flash" }'
```

**Clear a custom key** (falls back to env var)
```bash
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{ "apiKey": "" }'
```

---

## Available Models

| Provider | Models |
|----------|--------|
| `anthropic` | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5` |
| `openai` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| `gemini` | `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash` |

Default: **Anthropic `claude-opus-4-6`**

---

## Database

### Schema

| Table | Columns |
|-------|---------|
| `entries` | `id` (TEXT PK), `title`, `body`, `analysis` (JSONB), `created_at`, `updated_at` |
| `app_config` | `key` (TEXT PK), `provider`, `model`, `api_key`, `updated_at` |

Re-run `db/schema.sql` at any time — all statements use `IF NOT EXISTS` so it is safe to apply repeatedly.

### DB helpers (`db/helpers.js`)

| Function | Description |
|----------|-------------|
| `query(sql, params)` | Raw parameterised query |
| `getOne(table, conditions)` | SELECT … LIMIT 1, returns row or `null` |
| `getMany(table, conditions, options)` | SELECT with optional `orderBy / limit / offset` |
| `insert(table, data)` | INSERT … RETURNING \* |
| `update(table, data, conditions)` | UPDATE … RETURNING \* |
| `upsert(table, data, conflictCols)` | INSERT … ON CONFLICT DO UPDATE RETURNING \* |
| `remove(table, conditions)` | DELETE … RETURNING \* |

---

## Adding a New Provider

1. Create `services/providers/yourprovider.js` implementing two exports:
   ```js
   export async function analyzeEntry(text) { ... }
   export async function streamChat(history, message, context, onDelta) { ... }
   ```
2. Register it in `services/llm.js` and `storage/configStore.js` (`PROVIDER_MODELS`).
