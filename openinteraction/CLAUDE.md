# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Openinteraction is an AI agent-driven interactive user interview system. Instead of traditional surveys, users chat with an AI agent that conducts product experience research through natural conversation. The agent uses tool calling to record insights, extract annotations, mark topic coverage, and end the interview.

**Tech stack**: Node.js + Express backend, SQLite (better-sqlite3), OpenAI-compatible LLM API (DeepSeek by default), React + Vite frontend (not yet built).

## Development Commands

All commands run from `server/`:

```bash
npm run dev          # Start server with --watch hot reload (port 3001)
npm test             # Run all tests once (vitest run)
npm run test:watch   # Run tests in watch mode (vitest)
```

To run a single test file:
```bash
npx vitest run tests/routes/chat.test.js
```

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

```
server/src/
├── index.js          # Express app setup, routes, health endpoint
├── db/
│   ├── database.js   # initDb() + getDb() singleton (better-sqlite3, WAL mode)
│   └── schema.sql    # Tables: projects, interviews, messages, annotations
├── llm/
│   └── provider.js   # LLMProvider class wrapping OpenAI SDK for OpenAI-compatible APIs
├── agent/
│   ├── interviewAgent.js  # InterviewAgent — tool calling loop with max 5 iterations
│   ├── tools.js           # Tool definitions + executeTool() for 4 tools
│   └── promptBuilder.js   # buildSystemPrompt() from project config
├── routes/
│   ├── interview.js   # POST /api/interview/create, GET /api/interview/:token
│   └── chat.js        # POST /api/chat — main chat endpoint
└── services/
    └── conversationManager.js  # Message persistence + LLM-formatted history
```

**Request flow**: `POST /api/chat` → Chat route creates `LLMProvider` + `InterviewAgent` → Agent saves user message → builds system prompt from project config → sends conversation history + tools to LLM → loops on tool calls (up to 5 iterations) → saves assistant response → returns `{ response, tool_calls, interview_status }`.

**Agent tools**: `record_insight`, `mark_topic_covered`, `extract_annotation`, `end_interview` — all write to the `annotations` table. `end_interview` additionally updates the interview status to `completed`.

**Database**: SQLite with WAL mode and foreign keys. Single-file database, initialized at server startup via `initDb()`. The `getDb()` singleton is used across all modules. All IDs are UUID v4. The annotations table uses a flexible EAV-like schema where `category` + `label` differentiate record types.

## Project State

Server-side (Tasks 1-8) is complete. Client frontend (Tasks 9-15) is not yet started:
- React + Vite frontend setup, landing page, chat components, chat page, completion page, E2E verification, and admin routes remain to be built.

Design specs: `docs/superpowers/specs/2026-04-29-interview-agent-design.md`
Implementation plan: `docs/superpowers/plans/2026-04-29-interview-agent.md`
