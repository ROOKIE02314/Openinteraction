# Research Dashboard Design Spec

## Overview

A researcher-facing dashboard that turns completed interviews into a queryable knowledge base. Researchers see headline metrics per project (participant count, average duration, top keywords) and can ask an AI assistant freeform questions about that project's transcripts and annotations.

### Problem Statement

After interviews are collected, the raw conversations sit in SQLite with no surface for the researcher to:

1. See how many people participated and how engaged they were
2. Spot recurring themes across many interviews at a glance
3. Drill into "why did people say X" without manually reading every transcript

### Solution

A two-page dashboard at `/dashboard` that lists all projects and, on drill-in, presents a project detail page with a **left metrics column** (numeric cards, keyword chips, interview list) and a **right AI Q&A column** (chat interface scoped to that project's data).

### Scope

- MVP: Single user, no auth, runs on the same server as the interviewee app
- In: project list, project metrics, AI Q&A scoped per-project, persistent Q&A history
- Out: cross-project Q&A, RAG/embeddings, single-interview detail page, multi-user accounts, real-time streaming responses, batches/waves within a project

---

## System Architecture

```
┌──────────────────────┐    HTTP     ┌────────────────────────┐    SDK    ┌──────────────┐
│ /dashboard            │ ──────────► │ Express                │ ────────► │ LLM Provider │
│ /dashboard/projects/  │             │ ├─ routes/dashboard.js  │           │ (DeepSeek)   │
│   :id                 │             │ ├─ services/            │           └──────────────┘
│ (React, glass theme)  │             │ │   metricsService.js   │
└──────────────────────┘             │ │   researchAssistant.js│
                                      │ └─ db (better-sqlite3)  │
                                      └────────────────────────┘
                                                 │
                                                 ▼
                                      ┌────────────────────────┐
                                      │ SQLite                 │
                                      │ projects / interviews /│
                                      │ messages / annotations │
                                      │ + dashboard_chats (new)│
                                      └────────────────────────┘
```

The dashboard is additive: existing `/`, `/interview/:token`, `/interview/:token/chat`, `/interview/:token/complete` routes and the interviewee agent are untouched. Server-side, `index.js` mounts a new `dashboardRouter` under `/api/dashboard`.

### Components

| Component | Responsibility |
|-----------|---------------|
| **DashboardHome** (page) | Project card grid, calls `GET /api/dashboard/projects` |
| **ProjectDetail** (page) | Two-column layout, calls metrics + chats endpoints |
| **DashboardLayout** (component) | Shared shell (logo, breadcrumb), wraps both pages |
| **metricsService** (server) | Pure SQL aggregation, no LLM calls, milliseconds latency |
| **researchAssistant** (server) | Builds context from a project's transcripts + annotations, calls LLM, persists Q&A |

---

## Routing & Page Skeleton

Two new client routes, prefixed `/dashboard` to keep them isolated from interviewee routes. No auth in MVP, but the prefix is the seam where a future `requireAdmin` middleware would attach.

```
/                              → existing HomePage           (unchanged)
/interview/:token              → existing LandingPage         (unchanged)
/interview/:token/chat         → existing ChatPage            (unchanged)
/interview/:token/complete     → existing CompletePage        (unchanged)
/dashboard                     → DashboardHome   (new)        Project card grid
/dashboard/projects/:id        → ProjectDetail   (new)        Metrics + AI Q&A
```

New page modules:

- `client/src/pages/dashboard/DashboardHome.tsx`
- `client/src/pages/dashboard/ProjectDetail.tsx`
- `client/src/components/dashboard-layout/DashboardLayout.tsx`

---

## Visual Language

The Morandi cool-grey + glass-morphism token system already lives in `client/src/styles/tokens.css` (committed in `cd45d55`). The dashboard uses it as-is, no new colors or component libraries.

Reused primitives:

- **Backgrounds** — `--bg-gradient` for page; `--color-glass` + `--color-glass-border` for every card surface
- **Cards** — wrap in the existing `<SurfaceCard>` component (`client/src/components/surface/`); never hand-roll a glass card
- **Radius** — `--radius-md` (20px) for cards, `--radius-bubble` (28px) for chat bubbles, `--radius-pill` (40px) for keyword chips
- **Shadow + blur** — `--shadow-bubble` and `--blur-input` keep the dashboard visually identical to the interviewee chat
- **Type** — `Inter` via `--font-sans`, weights 400/500/600
- **Spacing** — 4/8 grid via `--space-*`

If a metric or chip needs an emphasis color, prefer adjusting opacity of `--color-glass-*` over introducing a new token. Severity (`high/medium/low` on annotations) is rendered as text labels, not as red/yellow/green — staying consistent with the template's restrained palette.

---

## Page 1: Project List (DashboardHome)

A responsive card grid of every project.

**Each card displays:**

- Project name (`projects.name`)
- Created-at as relative time (`3 days ago`)
- Three numeric badges: total participants / completed / average duration

**Click a card** → navigate to `/dashboard/projects/:id`.

**Metric calculation rules** (computed in `metricsService.getProjectsOverview`):

| Metric | SQL |
|---|---|
| total | `COUNT(*) FROM interviews WHERE project_id = ?` |
| completed | same, with `AND status = 'completed'` |
| avg_duration_min | `AVG((julianday(ended_at) - julianday(started_at)) * 24 * 60)` over completed only; `NULL` if no completed interviews |

Average duration intentionally excludes `in_progress` (no `ended_at`) and `abandoned` (would skew the mean) interviews. The card displays `—` when the value is null.

---

## Page 2: Project Detail (ProjectDetail)

Two-column layout. On viewports < 1280px the right column drops below the left (single-column stack); the design assumes a desktop research workflow.

### Left Column — Metrics

**(a) Overview strip** — four large number cards in a row:

- Participants (`total`)
- Completion rate (`completed / total`, percentage; `—` if total = 0)
- Average duration (minutes, completed only)
- Average messages per interview (`COUNT(messages) / COUNT(interviews)`, all statuses)

Average messages is included as a cheap proxy for interview depth.

**(b) Keyword chips** — three keyword groups by `annotations.category`:

- 痛点 (`pain_point`)
- 功能诉求 (`feature_request`)
- 正向反馈 (`positive_feedback`)

For each group, aggregate `(label, count)` from annotations where `interview_id` belongs to this project, sort by count desc, take top 10. Render each as a pill chip showing `label · count`.

**Click a chip** → replace the right-column input value with `为什么用户提到「{label}」？` and focus it (do not auto-send; do not append to existing draft text). Researcher edits and presses send.

`insight`, `topic_coverage`, and `summary` annotation categories are **not** rendered as keyword chips — they are aggregation noise (insights are long sentences, topic coverage is internal bookkeeping, summary is a per-interview wrapper). They remain available to the AI assistant via the context bundle.

**(c) Interview list** — collapsible section, default-collapsed showing 5 most recent rows. Columns: started_at, status, duration, insight count (`COUNT(annotations) WHERE category='insight'`).

Read-only — clicking a row does nothing in MVP. Single-interview detail is explicitly out of scope.

### Right Column — AI Q&A

A chat interface scoped to this project. Reuses the existing `<MessageList>` + `<MessageInput>` components from interviewee chat, restyled only via tokens (no new component).

**Conversation semantics:**

- One persistent conversation per project, loaded on page mount via `GET /api/dashboard/projects/:id/chats`
- A "清空对话" button calls `DELETE /api/dashboard/projects/:id/chats` and clears the local view
- While a request is pending, the input is disabled (same pattern as `ChatPage`)
- No streaming in MVP — show a typing indicator until the response returns

**Empty state:** if the project has zero interviews, the input is disabled and a placeholder reads `该项目还没有访谈数据`.

---

## AI Assistant: Prompt Construction

Every `POST /ask` call rebuilds the full context — there is no caching or RAG in MVP.

### Prompt structure

1. **System message** —
   > 你是一个用研助手。下面是项目「{project.name}」的全部访谈数据。基于这些数据回答用户问题，引用受访者原话时使用 `>` 引用块并标注来自第几次访谈（如 `访谈 #3`）。不要编造原文里没有的内容；如果数据中没有相关信息，明确说「现有访谈数据中未提及」。

2. **Context block** — concatenation of:
   - Project config: `product_context` + parsed `core_topics` (one line each)
   - All annotations grouped by category, formatted as bullet lists with `label`, `severity`, `quote`
   - All transcripts, one block per interview, prefixed `## 访谈 #{n} ({started_at})`. Within a block, messages are rendered as `用户: ...` / `助手: ...`. `tool_calls` columns are not included.

3. **History** — last 10 turns from `dashboard_chats` for this project, alternating user/assistant.

4. **User message** — the current question.

### Token budget and truncation

DeepSeek's context window is 64K tokens. The MVP target is single-project scope, where 50 interviews × 30 messages × 50 chars ≈ 75K chars ≈ 30K tokens — safely within budget.

Before sending, `researchAssistant` estimates token count using `Math.ceil(charCount / 2)` (Chinese-heavy heuristic). If the assembled context exceeds **50K tokens** (leaving headroom for history + response), interviews are dropped one at a time, ordered by `started_at ASC` (oldest first), until the total is under budget. The number of dropped interviews is returned to the client as `truncated: true` + `dropped_count: N`.

Truncation strategy is intentionally coarse (whole interviews, not chunks) so the truncation mode surfaces visibly rather than degrading silently. RAG/embeddings are deferred until this strategy actually breaks for a real project.

The system prompt gains a final line when truncation occurred:
> 注意：因数据量过大，已省略最早的 N 次访谈。

---

## Data Model Changes

Existing tables (`projects`, `interviews`, `messages`, `annotations`) are unchanged.

### New table: `dashboard_chats`

Researcher Q&A is stored separately from interviewee `messages` to avoid mixing two conceptually different conversations.

```sql
CREATE TABLE IF NOT EXISTS dashboard_chats (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dashboard_chats_project
  ON dashboard_chats(project_id, created_at);
```

Schema appended to `server/src/db/schema.sql`. `initDb()` already runs the entire file with `IF NOT EXISTS`, so existing databases pick up the new table on next startup with zero migration code.

---

## API Design

All five endpoints mount under `/api/dashboard`.

### `GET /api/dashboard/projects`

Returns the project list for the home page.

```json
[
  {
    "id": "uuid",
    "name": "搜索体验调研",
    "created_at": "2026-04-29 ...",
    "total": 12,
    "completed": 9,
    "avg_duration_min": 11.4
  }
]
```

### `GET /api/dashboard/projects/:id/metrics`

Returns everything the left column needs in one shot.

```json
{
  "project": { "id": "...", "name": "...", "created_at": "..." },
  "overview": {
    "total": 12,
    "completed": 9,
    "completion_rate": 0.75,
    "avg_duration_min": 11.4,
    "avg_messages_per_interview": 18.3
  },
  "keywords": {
    "pain_point":         [{ "label": "搜索不准", "count": 7 }, ...],
    "feature_request":    [{ "label": "支持语音搜索", "count": 3 }, ...],
    "positive_feedback":  [{ "label": "推荐很准", "count": 5 }, ...]
  },
  "interviews": [
    { "id": "...", "started_at": "...", "status": "completed",
      "duration_min": 12.3, "insight_count": 4 }
  ]
}
```

404 if `:id` does not exist.

### `GET /api/dashboard/projects/:id/chats`

Returns this project's research-assistant history, oldest first.

```json
[
  { "id": "...", "role": "user", "content": "...", "created_at": "..." },
  { "id": "...", "role": "assistant", "content": "...", "created_at": "..." }
]
```

### `POST /api/dashboard/projects/:id/ask`

Body: `{ "question": "string" }`.

On success the user message and the assistant reply are inserted into `dashboard_chats` as a single transaction **after** the LLM call returns successfully, then the response is sent:

```json
{
  "answer": "...",
  "truncated": false,
  "dropped_count": 0
}
```

On LLM failure: HTTP 502, `{ "error": "LLM 暂不可用，请稍后重试" }`. Neither the user message nor the missing assistant reply is written to `dashboard_chats` — the table never contains an orphan user turn.

If the project has zero interviews: HTTP 400, `{ "error": "该项目还没有访谈数据" }`.

### `DELETE /api/dashboard/projects/:id/chats`

Deletes all `dashboard_chats` rows for the project. Returns `204 No Content`.

---

## File Layout

```
server/src/
├── db/
│   └── schema.sql                 ✎ append dashboard_chats + index
├── routes/
│   └── dashboard.js               ★ new — 5 endpoints
├── services/
│   ├── metricsService.js          ★ new — pure SQL aggregation
│   └── researchAssistant.js       ★ new — context build + LLM + persistence
└── index.js                       ✎ mount app.use('/api/dashboard', ...)

server/tests/
├── routes/dashboard.test.js       ★ new — supertest happy + 404
├── services/metricsService.test.js     ★ new
└── services/researchAssistant.test.js  ★ new — LLMProvider mocked

client/src/
├── pages/dashboard/
│   ├── DashboardHome.tsx          ★ new
│   ├── DashboardHome.css          ★ new
│   ├── ProjectDetail.tsx          ★ new
│   └── ProjectDetail.css          ★ new
├── components/dashboard-layout/
│   ├── DashboardLayout.tsx        ★ new
│   └── dashboard-layout.css       ★ new
├── api/client.js                  ✎ add 5 dashboard methods
└── router.tsx                     ✎ add 2 routes
```

### Why split `metricsService` and `researchAssistant`

- `metricsService` is pure SQL, milliseconds, deterministic, safe to call frequently.
- `researchAssistant` is the LLM slow path: token-budgeted, can fail, has side effects (writes `dashboard_chats`).

Co-locating them would make caching, polling, and unit testing harder than separating them.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| LLM timeout / network error | `POST /ask` → 502 + friendly message; **no DB write** so no orphan rows |
| LLM returns empty body | Same as timeout |
| Project not found | All endpoints → 404 + `{ "error": "project not found" }` |
| No interviews in project | Metrics endpoints render 0/0/0 cards; `POST /ask` → 400; right column input disabled with placeholder |
| Context exceeds 50K tokens | Drop oldest interviews whole; return `truncated: true`; client shows "已基于最近 N 次访谈回答" tag under the AI bubble |
| User sends a second message before the first returns | Client disables input; identical to interviewee `ChatPage` behavior |
| `DELETE /chats` on a project with no chats | 204 (idempotent) |

---

## Testing Strategy

Sticking to the existing vitest + supertest setup — no new tooling.

**`tests/services/metricsService.test.js`** — real SQLite with fixtures, covering:

- Empty project (no interviews)
- Only `in_progress` interviews (avg_duration_min = null)
- Mixed `completed` / `in_progress` / `abandoned` (verify duration only averages completed)
- Keyword aggregation respects category filter, sorts by count desc, caps at 10

**`tests/services/researchAssistant.test.js`** — `LLMProvider` mocked (same pattern as existing chat tests):

- Context block ordering: system → product_context → annotations → transcripts → history → user
- History truncation: only last 10 turns reach the LLM
- Token budget: when `charCount/2 > 50000`, oldest interviews are dropped first; `dropped_count` returned correctly
- Failure path: when `LLMProvider.complete` throws, no rows are written to `dashboard_chats`

**`tests/routes/dashboard.test.js`** — supertest against the Express app:

- All 5 endpoints' happy path
- 404 on bad project id
- 400 on `POST /ask` for empty project
- 502 on `POST /ask` when LLM is mocked to throw

No frontend E2E tests — the project does not have a frontend test setup yet, manual verification suffices for MVP.

---

## Success Criteria

- Card grid renders all projects with correct counts and durations matching hand-computed SQL
- Project detail loads in < 200ms (metrics endpoint round-trip) on a project with 50 interviews
- On a real project with ≥ 5 interviews, asking 5 representative questions ("最常见的痛点", "有谁提到搜索很慢", "正向反馈集中在哪些功能", "受访者对搜索结果的态度", "有没有人建议加语音搜索") produces answers that:
  - Quote real text that appears in the database (`>` blocks must match an actual `messages.content` substring)
  - Reference interviews by index (`访谈 #3`)
  - Say "现有访谈数据中未提及" rather than fabricating when asked about missing topics
- Server-side test coverage matches or exceeds existing `routes/chat.test.js` for the new files

---

## Open Questions / Future Work

- **Single-interview detail page** — explicitly out of scope; revisit if researchers report wanting to read full transcripts directly.
- **Streaming responses** — defer until typical answer latency exceeds 5s.
- **RAG / embeddings** — defer until truncation triggers on a real project. The whole-interview drop is intentionally crude so this becomes visible.
- **Cross-project Q&A** — explicitly out of scope.
- **Auth** — `/dashboard` prefix is the seam; add middleware when the system leaves single-user MVP.
