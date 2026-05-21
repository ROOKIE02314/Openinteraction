# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Openinteraction is an AI agent-driven interactive user interview system. Instead of traditional surveys, users chat with an AI agent that conducts product experience research through natural conversation. The agent uses tool calling to record insights, extract annotations, mark topic coverage, and end the interview. A research dashboard lets product managers create projects, view analytics, and ask AI questions about collected interview data.

**Tech stack**: Node.js + Express 5 backend, SQLite (better-sqlite3, WAL mode), OpenAI-compatible LLM API (DeepSeek by default), React 19 + Vite + TypeScript frontend.

## Development Commands

### Server (from `server/`)

```bash
npm run dev          # Start server with --watch hot reload (port 3001)
npm test             # Run all tests once (vitest run)
npm run test:watch   # Run tests in watch mode (vitest)
```

Run a single test file:
```bash
npx vitest run tests/routes/chat.test.js
```

### Client (from `client/`)

```bash
npm run dev          # Vite dev server (port 5173)
npm run build        # TypeScript check + production build
npm run preview      # Preview production build
```

No client-side tests exist yet.

## Environment Variables

The server reads these from `.env`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_API_KEY` | `test` | API key for LLM provider |
| `LLM_BASE_URL` | `https://api.deepseek.com` | OpenAI-compatible API endpoint |
| `LLM_MODEL` | `deepseek-chat` | Model name to use |
| `DB_PATH` | `./data/interview.db` | SQLite database file path |
| `PORT` | `3001` | Server listen port |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL for share link generation |

Tests set `NODE_ENV=test` (server skips `app.listen` so supertest can bind). No `.env` is needed for tests — LLM calls are mocked in all test suites.

## Architecture

### Server (`server/src/`)

Three route groups mounted in `index.js`:

- **`/api/interview`** (`routes/interview.js`) — Create interview, get interview by token
- **`/api/chat`** (`routes/chat.js`) — Main chat endpoint: instantiates `LLMProvider` + `InterviewAgent`, loops on tool calls (max 5 iterations), persists messages
- **`/api/dashboard`** (`routes/dashboard.js`) — 7 endpoints for project CRUD, analytics overview, per-project metrics, AI research assistant Q&A

Key modules:
- `agent/interviewAgent.js` — Tool-calling loop: builds system prompt from project config, sends history + tools to LLM, processes tool calls
- `agent/tools.js` — 4 agent tools (`record_insight`, `extract_annotation`, `mark_topic_covered`, `end_interview`) + `executeTool()`
- `agent/promptBuilder.js` — Constructs system prompt from project configuration
- `services/metricsService.js` — Pure SQL aggregation (no LLM) for dashboard overview and per-project metrics
- `services/researchAssistant.js` — Per-project AI Q&A: builds context from annotations + transcripts, calls LLM, persists to `dashboard_chats` table, 50K token budget with oldest-first truncation
- `services/conversationManager.js` — Message persistence and LLM-formatted history
- `llm/provider.js` — `LLMProvider` class wrapping OpenAI SDK
- `db/database.js` — `initDb()` + `getDb()` singleton (better-sqlite3, WAL mode, foreign keys)

### Client (`client/src/`)

React 19 SPA with react-router-dom v7 (data router via `createBrowserRouter`), TypeScript, Vite.

**Routes** (defined in `router.tsx`):
- `/` — HomePage (landing)
- `/interview/:token` — LandingPage (interview start)
- `/interview/:token/chat` — ChatPage (active interview chat)
- `/interview/:token/complete` — CompletePage (post-interview)
- `/dashboard` — AnalyticsOverview (KPI cards, frequency chart, trending tags, recent interviews)
- `/dashboard/projects` — ProjectsList (card grid with stats)
- `/dashboard/create` — CreateProject (4-step wizard)
- `/dashboard/projects/:id` — ProjectDetail (metrics, keyword chips, AI Q&A panel)

**Key patterns**:
- `api/client.ts` — Fully typed API client (`fetch`-based) with typed interfaces for all endpoints
- `styles/tokens.css` — Morandi cool-grey design token system with CSS custom properties (colors, glass-morphism, shadows, blur, spacing 4/8px grid, animations, Inter font)
- `components/dashboard-layout/` — Shell layout (DashboardLayout + Sidebar with 80px icon rail)
- `components/charts/Sparkline.tsx` — Reusable inline-SVG line chart
- `components/surface/SurfaceCard.tsx` — Reusable card component
- `data/templates.json` — Static project templates by category

### Database

5 tables defined in `server/src/db/schema.sql`:
- `projects` — Name, product context, core topics (JSON), style guide (JSON)
- `interviews` — Links to project via `project_id`, has `share_token` for public access, status: `in_progress` / `completed` / `abandoned`
- `messages` — Chat messages per interview, role: `user` / `assistant` / `system`
- `annotations` — EAV-like schema with `category` + `label` differentiating record types (insights, extracted annotations, topic coverage)
- `dashboard_chats` — AI Q&A history per project, indexed on `(project_id, created_at)`

All IDs are UUID v4. Single-file SQLite with WAL mode and foreign keys enforced.

## Testing

Server uses **vitest** with **supertest** for HTTP assertions. 11 test files covering db, llm, agent, services, and routes. Tests use real SQLite databases (not mocked) — only LLM calls are mocked. Test databases are created per-test-file and cleaned up automatically.

## Design References

Design specs and implementation plans live in `docs/superpowers/`:
- `specs/` — Design specifications for each major feature
- `plans/` — Step-by-step implementation plans (tasks)
- `variant.com/` — HTML design reference files from variant.com
