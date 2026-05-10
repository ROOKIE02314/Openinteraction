# Openinteraction

AI agent-driven interactive user interview system. Instead of traditional surveys, users chat with an AI agent that conducts product experience research through natural conversation — recording insights, extracting annotations, tracking topic coverage, and closing interviews automatically.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express 5 |
| Database | SQLite (better-sqlite3, WAL mode) |
| LLM | OpenAI-compatible API (DeepSeek by default) |
| Frontend | React 19 + Vite + TypeScript + react-router-dom v7 |
| Testing | Vitest (server), Playwright (e2e planned) |

## Quick Start

### Prerequisites

- Node.js >= 18

### Setup

```bash
git clone <repo-url>
cd openinteraction

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Configure

Copy and edit the server environment file:

```bash
cd server
cp .env.example .env  # if available, or create .env manually
```

Required environment variables:

```env
LLM_API_KEY=your-api-key              # API key for LLM provider
LLM_BASE_URL=https://api.deepseek.com # OpenAI-compatible endpoint
LLM_MODEL=deepseek-chat               # Model name
DB_PATH=./data/interview.db           # SQLite database path
PORT=3001                             # Server port
FRONTEND_URL=http://localhost:5173    # CORS origin for frontend
```

### Run

Open two terminals:

```bash
# Terminal 1: Start the server (port 3001)
cd server
npm run dev

# Terminal 2: Start the client (port 5173)
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

## Project Structure

```
openinteraction/
├── server/
│   ├── src/
│   │   ├── index.js                 # Express app + health endpoint
│   │   ├── db/
│   │   │   ├── database.js          # SQLite init + singleton
│   │   │   └── schema.sql           # Tables: projects, interviews, messages, annotations
│   │   ├── llm/
│   │   │   └── provider.js          # LLMProvider wrapping OpenAI SDK
│   │   ├── agent/
│   │   │   ├── interviewAgent.js    # Tool-calling interview loop (max 5 iterations)
│   │   │   ├── tools.js             # 4 agent tools + executeTool()
│   │   │   └── promptBuilder.js     # System prompt from project config
│   │   ├── routes/
│   │   │   ├── interview.js         # POST /api/interview/create, GET /api/interview/:token
│   │   │   └── chat.js              # POST /api/chat — main chat endpoint
│   │   └── services/
│   │       └── conversationManager.js  # Message persistence + LLM history formatting
│   └── tests/
├── client/
│   └── src/
│       ├── main.tsx                 # React entry point
│       ├── App.tsx
│       ├── router.tsx               # React Router v7 config
│       ├── pages/                   # HomePage, ChatPage, CompletionPage
│       ├── components/              # UI components
│       ├── api/                     # API client utilities
│       └── styles/                  # Global styles + design tokens
└── docs/
    └── superpowers/
        ├── specs/                   # Design specifications
        └── plans/                   # Implementation plans
```

## API

### Health Check

```
GET /api/health
→ { "status": "ok" }
```

### Create Interview

```
POST /api/interview/create
Body: { "project_id": "<uuid>" }
→ { "id": "<uuid>", "token": "<uuid>", ... }
```

### Chat

```
POST /api/chat
Body: { "interview_id": "<uuid>", "message": "..." }
→ { "response": "...", "tool_calls": [...], "interview_status": "active|completed" }
```

### Get Interview

```
GET /api/interview/:token
→ { "id": "<uuid>", "status": "active|completed", ... }
```

## Agent Tools

The AI agent uses four tools during interviews:

| Tool | Purpose |
|------|---------|
| `record_insight` | Persist a qualitative insight from the user's response |
| `extract_annotation` | Tag a span of the conversation with a label |
| `mark_topic_covered` | Mark a research topic as sufficiently explored |
| `end_interview` | Close the interview when topics are exhausted |

All tools write to the `annotations` table. `end_interview` additionally sets the interview status to `completed`.

## Development

All server commands run from the `server/` directory:

```bash
npm run dev          # Start server with --watch hot reload (port 3001)
npm test             # Run all tests once
npm run test:watch   # Run tests in watch mode
```

Run a single test file:

```bash
npx vitest run tests/routes/chat.test.js
```

Tests use `NODE_ENV=test` (server skips `app.listen` so supertest can bind). LLM calls are mocked in all test suites — no `.env` file is required for tests.

## Architecture

**Request flow**: `POST /api/chat` → Express route instantiates `LLMProvider` + `InterviewAgent` → agent saves the user message → builds system prompt from project configuration → sends conversation history + tool definitions to the LLM → loops on tool calls (up to 5 iterations) → saves the assistant response → returns `{ response, tool_calls, interview_status }`.

**Database**: Single-file SQLite with WAL mode and foreign keys enforced. All IDs are UUID v4. The `annotations` table uses an EAV-like schema where `category` + `label` differentiate record types.

## Project Status

Server-side (Tasks 1–8) is complete. Client frontend is under active development.

## License

TBD
