# Research Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a researcher-facing dashboard at `/dashboard` that lists projects with headline metrics and lets a researcher ask AI questions scoped to each project's transcripts and annotations.

**Architecture:** Additive on top of the existing interview-agent server. Two new client routes under `/dashboard` reuse the Morandi-glass token system. Server adds three modules: a pure-SQL `metricsService` for fast aggregation, a `researchAssistant` that builds a per-project context bundle (annotations + transcripts) and calls the existing `LLMProvider`, and a `dashboard` route file that mounts under `/api/dashboard`. Q&A history is stored in a new `dashboard_chats` table.

**Tech Stack:** Node.js + Express, better-sqlite3, OpenAI-compatible LLM (DeepSeek), Vitest + supertest, React + Vite + TypeScript, react-router-dom.

**Spec:** `docs/superpowers/specs/2026-05-14-research-dashboard-design.md`

---

## File Structure

```
server/src/
├── db/schema.sql                           ✎ append dashboard_chats + index
├── services/metricsService.js              ★ new — pure SQL aggregation
├── services/researchAssistant.js           ★ new — context build + LLM + persistence
├── routes/dashboard.js                     ★ new — 5 endpoints
└── index.js                                ✎ mount /api/dashboard

server/tests/
├── services/metricsService.test.js         ★ new
├── services/researchAssistant.test.js      ★ new — LLM mocked
└── routes/dashboard.test.js                ★ new — supertest

client/src/
├── api/client.ts                           ✎ add 5 dashboard methods + types
├── components/dashboard-layout/
│   ├── DashboardLayout.tsx                 ★ new
│   └── dashboard-layout.css                ★ new
├── components/message-input/
│   └── MessageInput.tsx                    ✎ add optional controlled mode
├── pages/dashboard/
│   ├── DashboardHome.tsx                   ★ new
│   ├── dashboard-home.css                  ★ new
│   ├── ProjectDetail.tsx                   ★ new
│   └── project-detail.css                  ★ new
└── router.tsx                              ✎ add 2 routes
```

---

## Task 1: Schema Migration — `dashboard_chats` Table

**Files:**
- Modify: `server/src/db/schema.sql`
- Test: `server/tests/db/database.test.js` (existing — augment)

- [ ] **Step 1: Read existing schema test to find the right insertion point**

Read: `server/tests/db/database.test.js`. Locate where existing tables are asserted to exist.

- [ ] **Step 2: Write the failing test**

Append this test block to `server/tests/db/database.test.js` inside the existing `describe` block:

```js
it('creates dashboard_chats table with project FK and project+created_at index', () => {
  initDb(TEST_DB);
  const db = getDb();

  const cols = db.prepare("PRAGMA table_info('dashboard_chats')").all();
  const colNames = cols.map(c => c.name);
  expect(colNames).toEqual(
    expect.arrayContaining(['id', 'project_id', 'role', 'content', 'created_at'])
  );

  const indexes = db.prepare("PRAGMA index_list('dashboard_chats')").all();
  expect(indexes.some(i => i.name === 'idx_dashboard_chats_project')).toBe(true);

  const fks = db.prepare("PRAGMA foreign_key_list('dashboard_chats')").all();
  expect(fks.some(fk => fk.table === 'projects')).toBe(true);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/db/database.test.js`
Expected: FAIL — `dashboard_chats` table not found / index missing.

- [ ] **Step 4: Append schema DDL**

Append to `server/src/db/schema.sql`:

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

- [ ] **Step 5: Run test to verify it passes**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/db/database.test.js`
Expected: PASS — all assertions hold.

- [ ] **Step 6: Run full server test suite to verify no regression**

Run: `cd D:/school-business/openinteraction/server && npm test`
Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/db/schema.sql server/tests/db/database.test.js
git commit -m "feat(db): add dashboard_chats table for researcher Q&A history"
```

---

## Task 2: `metricsService.getProjectsOverview`

**Files:**
- Create: `server/src/services/metricsService.js`
- Test: `server/tests/services/metricsService.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/tests/services/metricsService.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, getDb } from '../../src/db/database.js';
import { getProjectsOverview } from '../../src/services/metricsService.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-metrics-overview.db';

function insertProject(name) {
  const id = uuid();
  getDb().prepare(
    'INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)'
  ).run(id, name, 'context', '[]');
  return id;
}

function insertInterview(projectId, status, startedAt, endedAt) {
  const id = uuid();
  getDb().prepare(
    'INSERT INTO interviews (id, project_id, share_token, status, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, uuid(), status, startedAt, endedAt);
  return id;
}

describe('getProjectsOverview', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('returns empty array when no projects', () => {
    expect(getProjectsOverview(getDb())).toEqual([]);
  });

  it('returns counts and avg duration per project', () => {
    const p1 = insertProject('搜索体验');
    insertInterview(p1, 'completed', '2026-05-01 10:00:00', '2026-05-01 10:10:00'); // 10 min
    insertInterview(p1, 'completed', '2026-05-02 10:00:00', '2026-05-02 10:20:00'); // 20 min
    insertInterview(p1, 'in_progress', '2026-05-03 10:00:00', null);

    const rows = getProjectsOverview(getDb());
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('搜索体验');
    expect(rows[0].total).toBe(3);
    expect(rows[0].completed).toBe(2);
    expect(rows[0].avg_duration_min).toBeCloseTo(15.0, 1);
  });

  it('returns avg_duration_min as null when no completed interviews', () => {
    const p1 = insertProject('Empty');
    insertInterview(p1, 'in_progress', '2026-05-01 10:00:00', null);

    const rows = getProjectsOverview(getDb());
    expect(rows[0].avg_duration_min).toBeNull();
  });

  it('excludes abandoned interviews from avg duration', () => {
    const p1 = insertProject('Mixed');
    insertInterview(p1, 'completed', '2026-05-01 10:00:00', '2026-05-01 10:10:00'); // 10 min
    insertInterview(p1, 'abandoned', '2026-05-02 10:00:00', '2026-05-02 11:00:00'); // would be 60 min

    const rows = getProjectsOverview(getDb());
    expect(rows[0].avg_duration_min).toBeCloseTo(10.0, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/services/metricsService.test.js`
Expected: FAIL — module `metricsService.js` not found.

- [ ] **Step 3: Create the service**

Create `server/src/services/metricsService.js`:

```js
export function getProjectsOverview(db) {
  return db.prepare(`
    SELECT
      p.id,
      p.name,
      p.created_at,
      COUNT(i.id) AS total,
      SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) AS completed,
      AVG(CASE
        WHEN i.status = 'completed' AND i.ended_at IS NOT NULL
        THEN (julianday(i.ended_at) - julianday(i.started_at)) * 24 * 60
        ELSE NULL
      END) AS avg_duration_min
    FROM projects p
    LEFT JOIN interviews i ON i.project_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/services/metricsService.test.js`
Expected: PASS — all four cases.

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/services/metricsService.js server/tests/services/metricsService.test.js
git commit -m "feat(metrics): add getProjectsOverview aggregation"
```

---

## Task 3: `metricsService.getProjectMetrics`

**Files:**
- Modify: `server/src/services/metricsService.js`
- Modify: `server/tests/services/metricsService.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/tests/services/metricsService.test.js` (in the same file, new `describe` block at the end):

```js
function insertMessage(interviewId, role, content) {
  getDb().prepare(
    'INSERT INTO messages (id, interview_id, role, content) VALUES (?, ?, ?, ?)'
  ).run(uuid(), interviewId, role, content);
}

function insertAnnotation(interviewId, category, label, severity = null) {
  getDb().prepare(
    'INSERT INTO annotations (id, interview_id, category, label, severity) VALUES (?, ?, ?, ?, ?)'
  ).run(uuid(), interviewId, category, label, severity);
}

describe('getProjectMetrics', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('returns null when project not found', async () => {
    const { getProjectMetrics } = await import('../../src/services/metricsService.js');
    expect(getProjectMetrics(getDb(), 'nonexistent')).toBeNull();
  });

  it('returns full metrics shape for a project with data', async () => {
    const { getProjectMetrics } = await import('../../src/services/metricsService.js');
    const p1 = insertProject('搜索体验');
    const i1 = insertInterview(p1, 'completed', '2026-05-01 10:00:00', '2026-05-01 10:10:00');
    const i2 = insertInterview(p1, 'completed', '2026-05-02 10:00:00', '2026-05-02 10:20:00');

    insertMessage(i1, 'user', 'msg1');
    insertMessage(i1, 'assistant', 'msg2');
    insertMessage(i2, 'user', 'msg3');

    insertAnnotation(i1, 'pain_point', '搜索不准', 'high');
    insertAnnotation(i1, 'pain_point', '搜索不准', 'high');
    insertAnnotation(i2, 'pain_point', '加载慢', 'medium');
    insertAnnotation(i1, 'feature_request', '语音搜索');
    insertAnnotation(i1, 'positive_feedback', '推荐很准');
    insertAnnotation(i1, 'insight', '用户重视速度'); // ignored in keyword chips

    const m = getProjectMetrics(getDb(), p1);

    expect(m.project.id).toBe(p1);
    expect(m.project.name).toBe('搜索体验');

    expect(m.overview.total).toBe(2);
    expect(m.overview.completed).toBe(2);
    expect(m.overview.completion_rate).toBeCloseTo(1.0);
    expect(m.overview.avg_duration_min).toBeCloseTo(15.0, 1);
    expect(m.overview.avg_messages_per_interview).toBeCloseTo(1.5, 1);

    expect(m.keywords.pain_point).toEqual([
      { label: '搜索不准', count: 2 },
      { label: '加载慢', count: 1 },
    ]);
    expect(m.keywords.feature_request).toEqual([{ label: '语音搜索', count: 1 }]);
    expect(m.keywords.positive_feedback).toEqual([{ label: '推荐很准', count: 1 }]);

    expect(m.interviews).toHaveLength(2);
    expect(m.interviews[0]).toMatchObject({ status: 'completed' });
    expect(m.interviews[0].duration_min).toBeCloseTo(20.0, 1);
    expect(m.interviews[0].insight_count).toBeGreaterThanOrEqual(0);
  });

  it('returns 0/0/null overview and empty keyword arrays for empty project', async () => {
    const { getProjectMetrics } = await import('../../src/services/metricsService.js');
    const p1 = insertProject('Empty');

    const m = getProjectMetrics(getDb(), p1);
    expect(m.overview.total).toBe(0);
    expect(m.overview.completed).toBe(0);
    expect(m.overview.completion_rate).toBeNull();
    expect(m.overview.avg_duration_min).toBeNull();
    expect(m.overview.avg_messages_per_interview).toBeNull();
    expect(m.keywords).toEqual({ pain_point: [], feature_request: [], positive_feedback: [] });
    expect(m.interviews).toEqual([]);
  });

  it('caps each keyword group at 10 entries sorted desc', async () => {
    const { getProjectMetrics } = await import('../../src/services/metricsService.js');
    const p1 = insertProject('Big');
    const i1 = insertInterview(p1, 'completed', '2026-05-01 10:00:00', '2026-05-01 10:10:00');
    for (let n = 1; n <= 12; n++) {
      for (let k = 0; k < n; k++) {
        insertAnnotation(i1, 'pain_point', `label-${n}`);
      }
    }

    const m = getProjectMetrics(getDb(), p1);
    expect(m.keywords.pain_point).toHaveLength(10);
    expect(m.keywords.pain_point[0]).toEqual({ label: 'label-12', count: 12 });
    expect(m.keywords.pain_point[9]).toEqual({ label: 'label-3', count: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/services/metricsService.test.js`
Expected: FAIL — `getProjectMetrics is not a function`.

- [ ] **Step 3: Implement `getProjectMetrics`**

Append to `server/src/services/metricsService.js`:

```js
const KEYWORD_CATEGORIES = ['pain_point', 'feature_request', 'positive_feedback'];

export function getProjectMetrics(db, projectId) {
  const project = db.prepare(
    'SELECT id, name, created_at FROM projects WHERE id = ?'
  ).get(projectId);
  if (!project) return null;

  const overview = db.prepare(`
    SELECT
      COUNT(i.id) AS total,
      SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) AS completed,
      AVG(CASE
        WHEN i.status = 'completed' AND i.ended_at IS NOT NULL
        THEN (julianday(i.ended_at) - julianday(i.started_at)) * 24 * 60
        ELSE NULL
      END) AS avg_duration_min,
      (
        SELECT CAST(COUNT(m.id) AS REAL) / NULLIF(COUNT(DISTINCT m.interview_id), 0)
        FROM messages m
        JOIN interviews i2 ON i2.id = m.interview_id
        WHERE i2.project_id = ?
      ) AS avg_messages_per_interview
    FROM interviews i
    WHERE i.project_id = ?
  `).get(projectId, projectId);

  const total = overview.total || 0;
  const completed = overview.completed || 0;
  const completion_rate = total === 0 ? null : completed / total;

  const keywords = {};
  const keywordStmt = db.prepare(`
    SELECT a.label AS label, COUNT(*) AS count
    FROM annotations a
    JOIN interviews i ON i.id = a.interview_id
    WHERE i.project_id = ? AND a.category = ?
    GROUP BY a.label
    ORDER BY count DESC, a.label ASC
    LIMIT 10
  `);
  for (const cat of KEYWORD_CATEGORIES) {
    keywords[cat] = keywordStmt.all(projectId, cat);
  }

  const interviews = db.prepare(`
    SELECT
      i.id,
      i.started_at,
      i.status,
      CASE
        WHEN i.ended_at IS NOT NULL
        THEN (julianday(i.ended_at) - julianday(i.started_at)) * 24 * 60
        ELSE NULL
      END AS duration_min,
      (SELECT COUNT(*) FROM annotations a
        WHERE a.interview_id = i.id AND a.category = 'insight') AS insight_count
    FROM interviews i
    WHERE i.project_id = ?
    ORDER BY i.started_at DESC
  `).all(projectId);

  return {
    project,
    overview: {
      total,
      completed,
      completion_rate,
      avg_duration_min: overview.avg_duration_min,
      avg_messages_per_interview: overview.avg_messages_per_interview,
    },
    keywords,
    interviews,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/services/metricsService.test.js`
Expected: PASS — all four cases (incl. 3 prior) pass.

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/services/metricsService.js server/tests/services/metricsService.test.js
git commit -m "feat(metrics): add getProjectMetrics for project detail page"
```

---

## Task 4: `researchAssistant.buildContext`

**Files:**
- Create: `server/src/services/researchAssistant.js`
- Test: `server/tests/services/researchAssistant.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/tests/services/researchAssistant.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, getDb } from '../../src/db/database.js';
import { buildContext } from '../../src/services/researchAssistant.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-research-assistant.db';

function insertProject(name, productContext = 'a product', topics = []) {
  const id = uuid();
  getDb().prepare(
    'INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)'
  ).run(id, name, productContext, JSON.stringify(topics));
  return id;
}

function insertInterview(projectId, startedAt) {
  const id = uuid();
  getDb().prepare(
    'INSERT INTO interviews (id, project_id, share_token, status, started_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, projectId, uuid(), 'completed', startedAt);
  return id;
}

function insertMessage(interviewId, role, content, createdAt) {
  getDb().prepare(
    'INSERT INTO messages (id, interview_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(uuid(), interviewId, role, content, createdAt);
}

describe('buildContext', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('returns null context for unknown project', () => {
    const result = buildContext(getDb(), 'nonexistent');
    expect(result).toBeNull();
  });

  it('builds context with product info, annotations, and transcripts', () => {
    const p1 = insertProject('搜索调研', '搜索引擎', [{ id: 'search', description: '搜索体验' }]);
    const i1 = insertInterview(p1, '2026-05-01 10:00:00');
    insertMessage(i1, 'user', '搜索经常找不到东西', '2026-05-01 10:00:01');
    insertMessage(i1, 'assistant', '能举个例子吗？', '2026-05-01 10:00:02');

    getDb().prepare(
      'INSERT INTO annotations (id, interview_id, category, label, severity, quote) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuid(), i1, 'pain_point', '搜索不准', 'high', '搜索经常找不到东西');

    const ctx = buildContext(getDb(), p1);
    expect(ctx).not.toBeNull();
    expect(ctx.context).toContain('搜索引擎');
    expect(ctx.context).toContain('搜索体验');
    expect(ctx.context).toContain('搜索不准');
    expect(ctx.context).toContain('搜索经常找不到东西');
    expect(ctx.context).toContain('能举个例子吗？');
    expect(ctx.context).toMatch(/## 访谈 #1/);
    expect(ctx.totalInterviews).toBe(1);
    expect(ctx.droppedCount).toBe(0);
  });

  it('orders interviews chronologically and numbers them starting at 1', () => {
    const p1 = insertProject('多访谈');
    const a = insertInterview(p1, '2026-05-01 10:00:00');
    const b = insertInterview(p1, '2026-05-02 10:00:00');
    insertMessage(a, 'user', '第一个访谈的话', '2026-05-01 10:00:01');
    insertMessage(b, 'user', '第二个访谈的话', '2026-05-02 10:00:01');

    const ctx = buildContext(getDb(), p1);
    const idxFirst = ctx.context.indexOf('## 访谈 #1');
    const idxSecond = ctx.context.indexOf('## 访谈 #2');
    expect(idxFirst).toBeGreaterThan(-1);
    expect(idxSecond).toBeGreaterThan(idxFirst);
    expect(ctx.context.indexOf('第一个访谈的话')).toBeLessThan(ctx.context.indexOf('第二个访谈的话'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/services/researchAssistant.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `buildContext`**

Create `server/src/services/researchAssistant.js`:

```js
const KEYWORD_CATEGORIES = ['pain_point', 'feature_request', 'positive_feedback', 'insight'];

function formatProjectIntro(project) {
  const topics = project.core_topics ? JSON.parse(project.core_topics) : [];
  const topicLines = topics.map(t => `- ${t.id || ''}: ${t.description || ''}`).join('\n');
  return [
    `# 项目「${project.name}」`,
    project.product_context ? `\n产品背景：${project.product_context}` : '',
    topicLines ? `\n核心话题：\n${topicLines}` : '',
  ].filter(Boolean).join('\n');
}

function formatAnnotations(db, projectId) {
  const groups = {};
  for (const cat of KEYWORD_CATEGORIES) {
    const rows = db.prepare(`
      SELECT a.label, a.severity, a.quote, a.context
      FROM annotations a
      JOIN interviews i ON i.id = a.interview_id
      WHERE i.project_id = ? AND a.category = ?
      ORDER BY a.created_at ASC
    `).all(projectId, cat);
    if (rows.length > 0) groups[cat] = rows;
  }

  if (Object.keys(groups).length === 0) return '';

  const lines = ['# 标注汇总'];
  for (const [cat, rows] of Object.entries(groups)) {
    lines.push(`\n## ${cat}`);
    for (const r of rows) {
      const sev = r.severity ? ` [${r.severity}]` : '';
      const quote = r.quote ? ` — 「${r.quote}」` : '';
      lines.push(`- ${r.label}${sev}${quote}`);
    }
  }
  return lines.join('\n');
}

function formatTranscripts(db, projectId, interviews) {
  const blocks = [];
  for (let n = 0; n < interviews.length; n++) {
    const iv = interviews[n];
    const messages = db.prepare(`
      SELECT role, content
      FROM messages
      WHERE interview_id = ? AND role IN ('user', 'assistant')
      ORDER BY created_at ASC
    `).all(iv.id);

    if (messages.length === 0) continue;

    const lines = [`## 访谈 #${n + 1} (${iv.started_at})`];
    for (const m of messages) {
      const speaker = m.role === 'user' ? '用户' : '助手';
      lines.push(`${speaker}: ${m.content}`);
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.length > 0 ? '# 访谈记录\n\n' + blocks.join('\n\n') : '';
}

export function buildContext(db, projectId) {
  const project = db.prepare(
    'SELECT id, name, product_context, core_topics FROM projects WHERE id = ?'
  ).get(projectId);
  if (!project) return null;

  const interviews = db.prepare(`
    SELECT id, started_at FROM interviews
    WHERE project_id = ? AND status IN ('completed', 'in_progress', 'abandoned')
    ORDER BY started_at ASC
  `).all(projectId);

  const totalInterviews = interviews.length;
  const intro = formatProjectIntro(project);
  const annotationsBlock = formatAnnotations(db, projectId);
  const transcriptsBlock = formatTranscripts(db, projectId, interviews);

  const parts = [intro, annotationsBlock, transcriptsBlock].filter(Boolean);
  return {
    context: parts.join('\n\n---\n\n'),
    totalInterviews,
    droppedCount: 0,
    interviews,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/services/researchAssistant.test.js`
Expected: PASS — all three cases.

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/services/researchAssistant.js server/tests/services/researchAssistant.test.js
git commit -m "feat(research-assistant): build per-project context from annotations and transcripts"
```

---

## Task 5: Token Budget + Truncation

**Files:**
- Modify: `server/src/services/researchAssistant.js`
- Modify: `server/tests/services/researchAssistant.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/tests/services/researchAssistant.test.js`:

```js
import { estimateTokens, buildContextWithBudget } from '../../src/services/researchAssistant.js';

describe('estimateTokens', () => {
  it('returns ceil(charCount/2)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a')).toBe(1);
    expect(estimateTokens('abc')).toBe(2);
    expect(estimateTokens('搜索体验调研报告')).toBe(4);
  });
});

describe('buildContextWithBudget', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('does not drop interviews when under budget', () => {
    const p1 = insertProject('Small');
    const i1 = insertInterview(p1, '2026-05-01 10:00:00');
    insertMessage(i1, 'user', 'short msg', '2026-05-01 10:00:01');

    const ctx = buildContextWithBudget(getDb(), p1, 100000);
    expect(ctx.droppedCount).toBe(0);
    expect(ctx.context).toContain('## 访谈 #1');
  });

  it('drops oldest interviews until under budget', () => {
    const p1 = insertProject('Big');
    const i1 = insertInterview(p1, '2026-05-01 10:00:00');
    const i2 = insertInterview(p1, '2026-05-02 10:00:00');
    const i3 = insertInterview(p1, '2026-05-03 10:00:00');
    const padding = 'x'.repeat(2000);
    insertMessage(i1, 'user', `OLDEST ${padding}`, '2026-05-01 10:00:01');
    insertMessage(i2, 'user', `MIDDLE ${padding}`, '2026-05-02 10:00:01');
    insertMessage(i3, 'user', `NEWEST ${padding}`, '2026-05-03 10:00:01');

    const ctx = buildContextWithBudget(getDb(), p1, 1500);
    expect(ctx.droppedCount).toBeGreaterThanOrEqual(1);
    expect(ctx.context).not.toContain('OLDEST');
    expect(ctx.context).toContain('NEWEST');
  });

  it('numbers remaining interviews starting at droppedCount+1', () => {
    const p1 = insertProject('Renumber');
    const i1 = insertInterview(p1, '2026-05-01 10:00:00');
    const i2 = insertInterview(p1, '2026-05-02 10:00:00');
    const padding = 'x'.repeat(2000);
    insertMessage(i1, 'user', `OLDEST ${padding}`, '2026-05-01 10:00:01');
    insertMessage(i2, 'user', `NEWEST ${padding}`, '2026-05-02 10:00:01');

    const ctx = buildContextWithBudget(getDb(), p1, 1500);
    expect(ctx.droppedCount).toBe(1);
    expect(ctx.context).toContain('## 访谈 #2');
    expect(ctx.context).not.toContain('## 访谈 #1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/services/researchAssistant.test.js`
Expected: FAIL — `estimateTokens`/`buildContextWithBudget` not exported.

- [ ] **Step 3: Implement budgeted builder**

Add to `server/src/services/researchAssistant.js`:

```js
export function estimateTokens(text) {
  return Math.ceil(text.length / 2);
}

function formatTranscriptsFromIndex(db, interviews, startIndex) {
  const blocks = [];
  for (let n = startIndex; n < interviews.length; n++) {
    const iv = interviews[n];
    const messages = db.prepare(`
      SELECT role, content
      FROM messages
      WHERE interview_id = ? AND role IN ('user', 'assistant')
      ORDER BY created_at ASC
    `).all(iv.id);

    if (messages.length === 0) continue;

    const lines = [`## 访谈 #${n + 1} (${iv.started_at})`];
    for (const m of messages) {
      const speaker = m.role === 'user' ? '用户' : '助手';
      lines.push(`${speaker}: ${m.content}`);
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.length > 0 ? '# 访谈记录\n\n' + blocks.join('\n\n') : '';
}

export function buildContextWithBudget(db, projectId, budgetTokens) {
  const base = buildContext(db, projectId);
  if (!base) return null;

  let droppedCount = 0;
  const interviews = base.interviews;

  while (droppedCount < interviews.length) {
    const intro = formatProjectIntro(
      db.prepare('SELECT id, name, product_context, core_topics FROM projects WHERE id = ?').get(projectId)
    );
    const annotationsBlock = formatAnnotations(db, projectId);
    const transcriptsBlock = formatTranscriptsFromIndex(db, interviews, droppedCount);

    const parts = [intro, annotationsBlock, transcriptsBlock].filter(Boolean);
    const context = parts.join('\n\n---\n\n');

    if (estimateTokens(context) <= budgetTokens) {
      return { context, totalInterviews: interviews.length, droppedCount, interviews };
    }
    droppedCount++;
  }

  // All interviews dropped — return intro + annotations only
  const project = db.prepare(
    'SELECT id, name, product_context, core_topics FROM projects WHERE id = ?'
  ).get(projectId);
  const intro = formatProjectIntro(project);
  const annotationsBlock = formatAnnotations(db, projectId);
  const context = [intro, annotationsBlock].filter(Boolean).join('\n\n---\n\n');
  return { context, totalInterviews: interviews.length, droppedCount: interviews.length, interviews };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/services/researchAssistant.test.js`
Expected: PASS — all six cases (incl. 3 prior) pass.

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/services/researchAssistant.js server/tests/services/researchAssistant.test.js
git commit -m "feat(research-assistant): add token estimation and oldest-first truncation"
```

---

## Task 6: `researchAssistant.ask` — LLM Call + Persistence

**Files:**
- Modify: `server/src/services/researchAssistant.js`
- Modify: `server/tests/services/researchAssistant.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/tests/services/researchAssistant.test.js`:

```js
import { vi } from 'vitest';
import { ask } from '../../src/services/researchAssistant.js';

describe('ask', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  function setupProject() {
    const p1 = insertProject('搜索调研', '搜索引擎', [{ id: 'search', description: '搜索体验' }]);
    const i1 = insertInterview(p1, '2026-05-01 10:00:00');
    insertMessage(i1, 'user', '搜索经常找不到东西', '2026-05-01 10:00:01');
    insertMessage(i1, 'assistant', '能举个例子吗？', '2026-05-01 10:00:02');
    return p1;
  }

  it('returns answer and persists user+assistant turns on success', async () => {
    const p1 = setupProject();
    const mockLLM = { chat: vi.fn().mockResolvedValue({ content: '看起来用户主要抱怨搜索不准。', toolCalls: [] }) };

    const result = await ask({ db: getDb(), projectId: p1, question: '主要痛点是？', llm: mockLLM });

    expect(result.answer).toBe('看起来用户主要抱怨搜索不准。');
    expect(result.truncated).toBe(false);
    expect(result.dropped_count).toBe(0);

    const rows = getDb().prepare('SELECT role, content FROM dashboard_chats WHERE project_id = ? ORDER BY created_at ASC').all(p1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ role: 'user', content: '主要痛点是？' });
    expect(rows[1]).toEqual({ role: 'assistant', content: '看起来用户主要抱怨搜索不准。' });
  });

  it('passes the last 10 dashboard_chats turns as history', async () => {
    const p1 = setupProject();
    const db = getDb();
    for (let n = 1; n <= 12; n++) {
      db.prepare('INSERT INTO dashboard_chats (id, project_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
        uuid(), p1, n % 2 === 0 ? 'assistant' : 'user', `old #${n}`, `2026-05-01 09:${String(n).padStart(2, '0')}:00`
      );
    }
    const mockLLM = { chat: vi.fn().mockResolvedValue({ content: 'reply', toolCalls: [] }) };

    await ask({ db, projectId: p1, question: '继续', llm: mockLLM });

    const callArg = mockLLM.chat.mock.calls[0][0];
    expect(callArg.messages.length).toBe(11); // 10 history + 1 user
    expect(callArg.messages[0].content).toBe('old #3');
    expect(callArg.messages[9].content).toBe('old #12');
    expect(callArg.messages[10].content).toBe('继续');
  });

  it('does not write to dashboard_chats when LLM throws', async () => {
    const p1 = setupProject();
    const mockLLM = { chat: vi.fn().mockRejectedValue(new Error('boom')) };

    await expect(
      ask({ db: getDb(), projectId: p1, question: '主要痛点是？', llm: mockLLM })
    ).rejects.toThrow('boom');

    const count = getDb().prepare('SELECT COUNT(*) AS c FROM dashboard_chats WHERE project_id = ?').get(p1).c;
    expect(count).toBe(0);
  });

  it('returns truncated:true and dropped_count when budget exceeded', async () => {
    const p1 = insertProject('Big', 'p', []);
    const padding = 'x'.repeat(3000);
    const i1 = insertInterview(p1, '2026-05-01 10:00:00');
    const i2 = insertInterview(p1, '2026-05-02 10:00:00');
    insertMessage(i1, 'user', `OLDEST ${padding}`, '2026-05-01 10:00:01');
    insertMessage(i2, 'user', `NEWEST ${padding}`, '2026-05-02 10:00:01');

    const mockLLM = { chat: vi.fn().mockResolvedValue({ content: 'ok', toolCalls: [] }) };
    const result = await ask({ db: getDb(), projectId: p1, question: '?', llm: mockLLM, budgetTokens: 1500 });

    expect(result.truncated).toBe(true);
    expect(result.dropped_count).toBeGreaterThanOrEqual(1);
    const callArg = mockLLM.chat.mock.calls[0][0];
    expect(callArg.system).toContain('已省略最早的');
  });

  it('throws an error with code NO_INTERVIEWS when project has no interviews', async () => {
    const p1 = insertProject('Empty', 'p', []);
    const mockLLM = { chat: vi.fn() };

    await expect(
      ask({ db: getDb(), projectId: p1, question: '?', llm: mockLLM })
    ).rejects.toMatchObject({ code: 'NO_INTERVIEWS' });

    expect(mockLLM.chat).not.toHaveBeenCalled();
  });

  it('throws an error with code NOT_FOUND when project does not exist', async () => {
    const mockLLM = { chat: vi.fn() };
    await expect(
      ask({ db: getDb(), projectId: 'nope', question: '?', llm: mockLLM })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/services/researchAssistant.test.js`
Expected: FAIL — `ask` not exported.

- [ ] **Step 3: Implement `ask`**

Append to `server/src/services/researchAssistant.js`:

```js
import { v4 as uuid } from 'uuid';

const DEFAULT_BUDGET_TOKENS = 50000;
const HISTORY_LIMIT = 10;

const SYSTEM_PROMPT_BASE =
  '你是一个用研助手。下面是项目「{name}」的全部访谈数据。' +
  '基于这些数据回答用户问题，引用受访者原话时使用 `>` 引用块并标注来自第几次访谈（如 `访谈 #3`）。' +
  '不要编造原文里没有的内容；如果数据中没有相关信息，明确说「现有访谈数据中未提及」。';

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function getRecentHistory(db, projectId) {
  const rows = db.prepare(`
    SELECT role, content FROM dashboard_chats
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(projectId, HISTORY_LIMIT);
  return rows.reverse();
}

export async function ask({ db, projectId, question, llm, budgetTokens = DEFAULT_BUDGET_TOKENS }) {
  const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(projectId);
  if (!project) throw makeError('NOT_FOUND', 'project not found');

  const interviewCount = db.prepare(
    'SELECT COUNT(*) AS c FROM interviews WHERE project_id = ?'
  ).get(projectId).c;
  if (interviewCount === 0) throw makeError('NO_INTERVIEWS', '该项目还没有访谈数据');

  const ctx = buildContextWithBudget(db, projectId, budgetTokens);

  let system = SYSTEM_PROMPT_BASE.replace('{name}', project.name) + '\n\n' + ctx.context;
  if (ctx.droppedCount > 0) {
    system += `\n\n注意：因数据量过大，已省略最早的 ${ctx.droppedCount} 次访谈。`;
  }

  const history = getRecentHistory(db, projectId);
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: question },
  ];

  const result = await llm.chat({ system, messages });
  const answer = result.content;

  const writeTx = db.transaction(() => {
    db.prepare(
      'INSERT INTO dashboard_chats (id, project_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(uuid(), projectId, 'user', question);
    db.prepare(
      'INSERT INTO dashboard_chats (id, project_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(uuid(), projectId, 'assistant', answer);
  });
  writeTx();

  return {
    answer,
    truncated: ctx.droppedCount > 0,
    dropped_count: ctx.droppedCount,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/services/researchAssistant.test.js`
Expected: PASS — all eleven cases pass.

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/services/researchAssistant.js server/tests/services/researchAssistant.test.js
git commit -m "feat(research-assistant): add ask() with transactional persistence and history"
```

---

## Task 7: Routes — `GET /projects` and `GET /projects/:id/metrics`

**Files:**
- Create: `server/src/routes/dashboard.js`
- Create: `server/tests/routes/dashboard.test.js`
- Modify: `server/src/index.js` (mount happens in Task 10; for now we test via direct router import)

- [ ] **Step 1: Write the failing test**

Create `server/tests/routes/dashboard.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDb, getDb } from '../../src/db/database.js';
import dashboardRouter from '../../src/routes/dashboard.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-routes-dashboard.db';

let app;

beforeAll(() => {
  process.env.DB_PATH = TEST_DB;
  app = express();
  app.use(express.json());
  app.use('/api/dashboard', dashboardRouter);
});

describe('Dashboard routes — list + metrics', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('GET /api/dashboard/projects returns []', async () => {
    const res = await request(app).get('/api/dashboard/projects').expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/dashboard/projects returns aggregated rows', async () => {
    const db = getDb();
    const pid = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      pid, 'P1', 'ctx', '[]'
    );
    db.prepare('INSERT INTO interviews (id, project_id, share_token, status, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      uuid(), pid, uuid(), 'completed', '2026-05-01 10:00:00', '2026-05-01 10:10:00'
    );

    const res = await request(app).get('/api/dashboard/projects').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: 'P1', total: 1, completed: 1 });
  });

  it('GET /api/dashboard/projects/:id/metrics returns 404 when missing', async () => {
    await request(app).get('/api/dashboard/projects/nonexistent/metrics').expect(404);
  });

  it('GET /api/dashboard/projects/:id/metrics returns shape', async () => {
    const db = getDb();
    const pid = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      pid, 'P1', 'ctx', '[]'
    );

    const res = await request(app).get(`/api/dashboard/projects/${pid}/metrics`).expect(200);
    expect(res.body.project.id).toBe(pid);
    expect(res.body.overview).toBeDefined();
    expect(res.body.keywords).toBeDefined();
    expect(res.body.interviews).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/routes/dashboard.test.js`
Expected: FAIL — `routes/dashboard.js` not found.

- [ ] **Step 3: Create the router with two endpoints**

Create `server/src/routes/dashboard.js`:

```js
import { Router } from 'express';
import { getDb } from '../db/database.js';
import { getProjectsOverview, getProjectMetrics } from '../services/metricsService.js';

const router = Router();

router.get('/projects', (req, res) => {
  res.json(getProjectsOverview(getDb()));
});

router.get('/projects/:id/metrics', (req, res) => {
  const m = getProjectMetrics(getDb(), req.params.id);
  if (!m) return res.status(404).json({ error: 'project not found' });
  res.json(m);
});

export default router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/routes/dashboard.test.js`
Expected: PASS — all four cases pass.

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/routes/dashboard.js server/tests/routes/dashboard.test.js
git commit -m "feat(routes): add /api/dashboard list and metrics endpoints"
```

---

## Task 8: Routes — `GET /chats` and `DELETE /chats`

**Files:**
- Modify: `server/src/routes/dashboard.js`
- Modify: `server/tests/routes/dashboard.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/tests/routes/dashboard.test.js`:

```js
describe('Dashboard routes — chats CRUD', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('GET /api/dashboard/projects/:id/chats returns 404 when project missing', async () => {
    await request(app).get('/api/dashboard/projects/nonexistent/chats').expect(404);
  });

  it('GET /api/dashboard/projects/:id/chats returns rows oldest first', async () => {
    const db = getDb();
    const pid = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(pid, 'P', 'c', '[]');
    db.prepare('INSERT INTO dashboard_chats (id, project_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
      uuid(), pid, 'user', '一', '2026-05-01 10:00:00'
    );
    db.prepare('INSERT INTO dashboard_chats (id, project_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').run(
      uuid(), pid, 'assistant', '二', '2026-05-01 10:00:01'
    );

    const res = await request(app).get(`/api/dashboard/projects/${pid}/chats`).expect(200);
    expect(res.body.map(r => r.content)).toEqual(['一', '二']);
  });

  it('DELETE /api/dashboard/projects/:id/chats returns 204 and clears rows', async () => {
    const db = getDb();
    const pid = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(pid, 'P', 'c', '[]');
    db.prepare('INSERT INTO dashboard_chats (id, project_id, role, content) VALUES (?, ?, ?, ?)').run(
      uuid(), pid, 'user', 'hi'
    );

    await request(app).delete(`/api/dashboard/projects/${pid}/chats`).expect(204);

    const count = db.prepare('SELECT COUNT(*) AS c FROM dashboard_chats WHERE project_id = ?').get(pid).c;
    expect(count).toBe(0);
  });

  it('DELETE on a project with no chats is idempotent (204)', async () => {
    const db = getDb();
    const pid = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(pid, 'P', 'c', '[]');

    await request(app).delete(`/api/dashboard/projects/${pid}/chats`).expect(204);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/routes/dashboard.test.js`
Expected: FAIL — endpoints not found.

- [ ] **Step 3: Add endpoints**

Append to `server/src/routes/dashboard.js` (before `export default router;`):

```js
function projectExists(db, id) {
  return db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id) !== undefined;
}

router.get('/projects/:id/chats', (req, res) => {
  const db = getDb();
  if (!projectExists(db, req.params.id)) {
    return res.status(404).json({ error: 'project not found' });
  }
  const rows = db.prepare(
    'SELECT id, role, content, created_at FROM dashboard_chats WHERE project_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);
  res.json(rows);
});

router.delete('/projects/:id/chats', (req, res) => {
  const db = getDb();
  if (!projectExists(db, req.params.id)) {
    return res.status(404).json({ error: 'project not found' });
  }
  db.prepare('DELETE FROM dashboard_chats WHERE project_id = ?').run(req.params.id);
  res.status(204).end();
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/routes/dashboard.test.js`
Expected: PASS — all eight cases pass.

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/routes/dashboard.js server/tests/routes/dashboard.test.js
git commit -m "feat(routes): add dashboard chats list and clear endpoints"
```

---

## Task 9: Route — `POST /projects/:id/ask`

**Files:**
- Modify: `server/src/routes/dashboard.js`
- Modify: `server/tests/routes/dashboard.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/tests/routes/dashboard.test.js`:

```js
describe('Dashboard routes — POST /ask', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('returns 404 when project missing', async () => {
    await request(app)
      .post('/api/dashboard/projects/nonexistent/ask')
      .send({ question: 'hi' })
      .expect(404);
  });

  it('returns 400 when body missing question', async () => {
    const db = getDb();
    const pid = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(pid, 'P', 'c', '[]');

    await request(app)
      .post(`/api/dashboard/projects/${pid}/ask`)
      .send({})
      .expect(400);
  });

  it('returns 400 with code NO_INTERVIEWS when project has no interviews', async () => {
    const db = getDb();
    const pid = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(pid, 'P', 'c', '[]');

    const res = await request(app)
      .post(`/api/dashboard/projects/${pid}/ask`)
      .send({ question: '?' })
      .expect(400);
    expect(res.body.error).toContain('该项目还没有访谈数据');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/routes/dashboard.test.js`
Expected: FAIL — POST /ask handler missing.

- [ ] **Step 3: Add the route**

Append to `server/src/routes/dashboard.js` (before `export default router;`):

```js
import { LLMProvider } from '../llm/provider.js';
import { ask } from '../services/researchAssistant.js';

router.post('/projects/:id/ask', async (req, res) => {
  const db = getDb();
  if (!projectExists(db, req.params.id)) {
    return res.status(404).json({ error: 'project not found' });
  }
  const { question } = req.body || {};
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    const llm = new LLMProvider();
    const result = await ask({ db, projectId: req.params.id, question: question.trim(), llm });
    res.json(result);
  } catch (err) {
    if (err.code === 'NO_INTERVIEWS') {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'project not found' });
    }
    console.error('Dashboard ask error:', err);
    res.status(502).json({ error: 'LLM 暂不可用，请稍后重试' });
  }
});
```

Move the two `import` statements to the **top of the file** (next to the existing imports). The file's imports must be:

```js
import { Router } from 'express';
import { getDb } from '../db/database.js';
import { getProjectsOverview, getProjectMetrics } from '../services/metricsService.js';
import { LLMProvider } from '../llm/provider.js';
import { ask } from '../services/researchAssistant.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/routes/dashboard.test.js`
Expected: PASS — all eleven cases pass.

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/routes/dashboard.js server/tests/routes/dashboard.test.js
git commit -m "feat(routes): add POST /api/dashboard/projects/:id/ask"
```

---

## Task 10: Mount Dashboard Router in `index.js`

**Files:**
- Modify: `server/src/index.js`

- [ ] **Step 1: Add import and mount**

Edit `server/src/index.js`. Add the import next to the existing route imports:

```js
import dashboardRoutes from './routes/dashboard.js';
```

Add the mount line after `app.use('/api/chat', chatRoutes);`:

```js
app.use('/api/dashboard', dashboardRoutes);
```

- [ ] **Step 2: Verify health endpoint and full server boots**

Run: `cd D:/school-business/openinteraction/server && npm test`
Expected: all tests pass — no regression.

- [ ] **Step 3: Smoke-test that the route is reachable**

Append to `server/tests/routes/dashboard.test.js` a small smoke test that imports the full app:

```js
describe('Dashboard router mounted on app', () => {
  it('GET /api/dashboard/projects via real app returns 200', async () => {
    process.env.DB_PATH = TEST_DB;
    process.env.LLM_API_KEY = 'test';
    process.env.LLM_BASE_URL = 'http://localhost:9999';
    const mod = await import('../../src/index.js');
    initDb(TEST_DB);
    await request(mod.default).get('/api/dashboard/projects').expect(200);
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });
});
```

Run: `cd D:/school-business/openinteraction/server && npx vitest run tests/routes/dashboard.test.js`
Expected: PASS — including the smoke test.

- [ ] **Step 4: Commit**

```bash
cd D:/school-business/openinteraction
git add server/src/index.js server/tests/routes/dashboard.test.js
git commit -m "feat(server): mount dashboard router under /api/dashboard"
```

---

## Task 11: Client API Methods + Types

**Files:**
- Modify: `client/src/api/client.ts`

- [ ] **Step 1: Add types and 5 methods**

Append to `client/src/api/client.ts`:

```ts
export interface ProjectOverview {
  id: string;
  name: string;
  created_at: string;
  total: number;
  completed: number;
  avg_duration_min: number | null;
}

export interface KeywordEntry {
  label: string;
  count: number;
}

export interface ProjectMetrics {
  project: { id: string; name: string; created_at: string };
  overview: {
    total: number;
    completed: number;
    completion_rate: number | null;
    avg_duration_min: number | null;
    avg_messages_per_interview: number | null;
  };
  keywords: {
    pain_point: KeywordEntry[];
    feature_request: KeywordEntry[];
    positive_feedback: KeywordEntry[];
  };
  interviews: Array<{
    id: string;
    started_at: string;
    status: 'in_progress' | 'completed' | 'abandoned';
    duration_min: number | null;
    insight_count: number;
  }>;
}

export interface DashboardChat {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AskResponse {
  answer: string;
  truncated: boolean;
  dropped_count: number;
}

export function listProjects(): Promise<ProjectOverview[]> {
  return request<ProjectOverview[]>('/dashboard/projects');
}

export function getProjectMetrics(id: string): Promise<ProjectMetrics> {
  return request<ProjectMetrics>(`/dashboard/projects/${id}/metrics`);
}

export function getDashboardChats(id: string): Promise<DashboardChat[]> {
  return request<DashboardChat[]>(`/dashboard/projects/${id}/chats`);
}

export function askDashboard(id: string, question: string): Promise<AskResponse> {
  return request<AskResponse>(`/dashboard/projects/${id}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export function clearDashboardChats(id: string): Promise<void> {
  return request<void>(`/dashboard/projects/${id}/chats`, { method: 'DELETE' });
}
```

- [ ] **Step 2: Type-check**

Run: `cd D:/school-business/openinteraction/client && npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/api/client.ts
git commit -m "feat(client-api): add 5 dashboard methods and types"
```

---

## Task 12: `MessageInput` — Optional Controlled Mode

**Files:**
- Modify: `client/src/components/message-input/MessageInput.tsx`

- [ ] **Step 1: Add controlled props (backward compatible)**

Replace the contents of `client/src/components/message-input/MessageInput.tsx` with:

```tsx
import { useState, useRef, type FormEvent, type KeyboardEvent, useEffect } from 'react';
import './message-input.css';

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  value?: string;
  onValueChange?: (next: string) => void;
}

function MessageInput({ onSend, disabled = false, value, onValueChange }: MessageInputProps) {
  const isControlled = value !== undefined && onValueChange !== undefined;
  const [internal, setInternal] = useState('');
  const text = isControlled ? (value as string) : internal;
  const setText = (next: string) => {
    if (isControlled) onValueChange!(next);
    else setInternal(next);
  };
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
    if (taRef.current) taRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  return (
    <form className="msg-input-container" onSubmit={submit}>
      <div className="msg-input-frame">
        <div className="msg-input-inner">
          <textarea
            ref={taRef}
            className="msg-input-field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说说你的想法..."
            disabled={disabled}
            rows={1}
          />
          <button
            type="submit"
            className="msg-input-submit"
            disabled={disabled || !text.trim()}
            aria-label="发送"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8L14 2L10 14L8 10L6 8L2 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </form>
  );
}

export default MessageInput;
```

This keeps the uncontrolled API backward compatible — existing `ChatPage` keeps working.

- [ ] **Step 2: Type-check**

Run: `cd D:/school-business/openinteraction/client && npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start the client (`cd D:/school-business/openinteraction/client && npm run dev`), open `/interview/<existing-token>/chat` and verify the existing chat input still types and sends. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/components/message-input/MessageInput.tsx
git commit -m "feat(message-input): support optional controlled value/onValueChange"
```

---

## Task 13: `DashboardLayout` Component

**Files:**
- Create: `client/src/components/dashboard-layout/DashboardLayout.tsx`
- Create: `client/src/components/dashboard-layout/dashboard-layout.css`

- [ ] **Step 1: Create the component**

Create `client/src/components/dashboard-layout/DashboardLayout.tsx`:

```tsx
import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './dashboard-layout.css';

interface DashboardLayoutProps {
  breadcrumb?: ReactNode;
  children: ReactNode;
}

function DashboardLayout({ breadcrumb, children }: DashboardLayoutProps) {
  return (
    <div className="dash-layout">
      <header className="dash-header">
        <Link to="/dashboard" className="dash-brand">
          <span className="dash-brand-dot" />
          <span className="dash-brand-text">研究面板</span>
        </Link>
        {breadcrumb && <nav className="dash-breadcrumb">{breadcrumb}</nav>}
      </header>
      <main className="dash-main">{children}</main>
    </div>
  );
}

export default DashboardLayout;
```

- [ ] **Step 2: Create the styles**

Create `client/src/components/dashboard-layout/dashboard-layout.css`:

```css
.dash-layout {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.dash-header {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-5) var(--space-8);
  background: var(--color-glass);
  border-bottom: 1px solid var(--color-glass-border);
  backdrop-filter: var(--blur-card);
  -webkit-backdrop-filter: var(--blur-card);
}

.dash-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-tight);
}

.dash-brand-dot {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-circle);
  background: var(--color-glass-user);
  border: 1px solid var(--color-glass-border);
  box-shadow: var(--shadow-dot);
}

.dash-brand-text {
  font-size: 16px;
}

.dash-breadcrumb {
  color: var(--color-text-secondary);
  font-size: 13px;
  letter-spacing: var(--letter-spacing-base);
}

.dash-breadcrumb a {
  color: var(--color-text-secondary);
  text-decoration: none;
}

.dash-breadcrumb a:hover {
  color: var(--color-text-primary);
}

.dash-main {
  flex: 1;
  padding: var(--space-8);
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
}
```

- [ ] **Step 3: Type-check**

Run: `cd D:/school-business/openinteraction/client && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/components/dashboard-layout/
git commit -m "feat(dashboard): add DashboardLayout shell"
```

---

## Task 14: `DashboardHome` — Project Card Grid

**Files:**
- Create: `client/src/pages/dashboard/DashboardHome.tsx`
- Create: `client/src/pages/dashboard/dashboard-home.css`

- [ ] **Step 1: Create the page**

Create `client/src/pages/dashboard/DashboardHome.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import { listProjects, type ProjectOverview } from '../../api/client';
import './dashboard-home.css';

function formatRelative(iso: string): string {
  const then = new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const ms = Date.now() - then;
  const min = Math.round(ms / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(then).toISOString().slice(0, 10);
}

function DashboardHome() {
  const [projects, setProjects] = useState<ProjectOverview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, []);

  return (
    <DashboardLayout>
      <h1 className="dh-title">研究项目</h1>
      {error && <p className="dh-error" role="alert">{error}</p>}
      {projects === null && !error && <p className="dh-loading">加载中…</p>}
      {projects && projects.length === 0 && (
        <SurfaceCard className="dh-empty">
          <p>还没有项目。先在受访者端创建访谈链接吧。</p>
        </SurfaceCard>
      )}
      {projects && projects.length > 0 && (
        <div className="dh-grid">
          {projects.map((p) => (
            <Link key={p.id} to={`/dashboard/projects/${p.id}`} className="dh-card-link">
              <SurfaceCard className="dh-card">
                <h2 className="dh-card-name">{p.name}</h2>
                <p className="dh-card-time">{formatRelative(p.created_at)}</p>
                <div className="dh-card-stats">
                  <div className="dh-stat">
                    <div className="dh-stat-num">{p.total}</div>
                    <div className="dh-stat-label">参与</div>
                  </div>
                  <div className="dh-stat">
                    <div className="dh-stat-num">{p.completed}</div>
                    <div className="dh-stat-label">完成</div>
                  </div>
                  <div className="dh-stat">
                    <div className="dh-stat-num">
                      {p.avg_duration_min === null ? '—' : `${p.avg_duration_min.toFixed(1)}m`}
                    </div>
                    <div className="dh-stat-label">平均时长</div>
                  </div>
                </div>
              </SurfaceCard>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export default DashboardHome;
```

- [ ] **Step 2: Create styles**

Create `client/src/pages/dashboard/dashboard-home.css`:

```css
.dh-title {
  font-size: 28px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-6);
  letter-spacing: var(--letter-spacing-tight);
}

.dh-loading,
.dh-error {
  color: var(--color-text-secondary);
}

.dh-error {
  color: #8a4a4a;
}

.dh-empty {
  padding: var(--space-8);
  color: var(--color-text-secondary);
}

.dh-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-5);
}

.dh-card-link {
  text-decoration: none;
}

.dh-card {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: background var(--duration-fast) var(--ease-standard);
}

.dh-card-link:hover .dh-card {
  background: var(--color-glass-hover);
}

.dh-card-name {
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.dh-card-time {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0;
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.dh-card-stats {
  display: flex;
  gap: var(--space-5);
  margin-top: var(--space-2);
}

.dh-stat-num {
  font-size: 22px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.dh-stat-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}
```

- [ ] **Step 3: Type-check**

Run: `cd D:/school-business/openinteraction/client && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/pages/dashboard/DashboardHome.tsx client/src/pages/dashboard/dashboard-home.css
git commit -m "feat(dashboard): add project list home page"
```

---

## Task 15: `ProjectDetail` — Skeleton + Left Column (Overview + Interviews)

**Files:**
- Create: `client/src/pages/dashboard/ProjectDetail.tsx`
- Create: `client/src/pages/dashboard/project-detail.css`

- [ ] **Step 1: Create the page (overview + interview list only; chips and Q&A in next tasks)**

Create `client/src/pages/dashboard/ProjectDetail.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import { getProjectMetrics, type ProjectMetrics } from '../../api/client';
import './project-detail.css';

function formatRate(r: number | null): string {
  return r === null ? '—' : `${(r * 100).toFixed(0)}%`;
}

function formatNum(n: number | null, suffix = ''): string {
  return n === null ? '—' : `${n.toFixed(1)}${suffix}`;
}

function ProjectDetail() {
  const { id } = useParams();
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllInterviews, setShowAllInterviews] = useState(false);

  useEffect(() => {
    if (!id) return;
    getProjectMetrics(id)
      .then(setMetrics)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, [id]);

  if (error) {
    return (
      <DashboardLayout breadcrumb={<Link to="/dashboard">← 返回</Link>}>
        <p className="pd-error" role="alert">{error}</p>
      </DashboardLayout>
    );
  }

  if (!metrics) {
    return (
      <DashboardLayout breadcrumb={<Link to="/dashboard">← 返回</Link>}>
        <p className="pd-loading">加载中…</p>
      </DashboardLayout>
    );
  }

  const o = metrics.overview;
  const interviewsToShow = showAllInterviews ? metrics.interviews : metrics.interviews.slice(0, 5);

  return (
    <DashboardLayout breadcrumb={<><Link to="/dashboard">研究项目</Link> / {metrics.project.name}</>}>
      <div className="pd-grid">
        <section className="pd-left">
          <h1 className="pd-title">{metrics.project.name}</h1>

          <div className="pd-overview-row">
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{o.total}</div>
              <div className="pd-stat-label">参与人数</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatRate(o.completion_rate)}</div>
              <div className="pd-stat-label">完成率</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatNum(o.avg_duration_min, 'm')}</div>
              <div className="pd-stat-label">平均时长</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatNum(o.avg_messages_per_interview)}</div>
              <div className="pd-stat-label">平均消息数</div>
            </SurfaceCard>
          </div>

          <SurfaceCard className="pd-section">
            <header className="pd-section-header">
              <h2 className="pd-section-title">访谈记录</h2>
              {metrics.interviews.length > 5 && (
                <button
                  className="pd-toggle-btn"
                  type="button"
                  onClick={() => setShowAllInterviews(v => !v)}
                >
                  {showAllInterviews ? '收起' : `展开全部 (${metrics.interviews.length})`}
                </button>
              )}
            </header>
            {metrics.interviews.length === 0 ? (
              <p className="pd-empty-text">暂无访谈</p>
            ) : (
              <table className="pd-iv-table">
                <thead>
                  <tr>
                    <th>开始时间</th>
                    <th>状态</th>
                    <th>时长</th>
                    <th>洞察数</th>
                  </tr>
                </thead>
                <tbody>
                  {interviewsToShow.map(iv => (
                    <tr key={iv.id}>
                      <td>{iv.started_at}</td>
                      <td>{iv.status}</td>
                      <td>{iv.duration_min === null ? '—' : `${iv.duration_min.toFixed(1)}m`}</td>
                      <td>{iv.insight_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SurfaceCard>
        </section>

        <section className="pd-right">
          <SurfaceCard className="pd-qa-placeholder">
            <p>AI 问答（下一步实现）</p>
          </SurfaceCard>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default ProjectDetail;
```

- [ ] **Step 2: Create styles**

Create `client/src/pages/dashboard/project-detail.css`:

```css
.pd-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 480px);
  gap: var(--space-6);
}

@media (max-width: 1280px) {
  .pd-grid {
    grid-template-columns: 1fr;
  }
}

.pd-left,
.pd-right {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 0;
}

.pd-title {
  font-size: 26px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: var(--letter-spacing-tight);
}

.pd-loading,
.pd-error {
  color: var(--color-text-secondary);
}

.pd-overview-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.pd-stat-card {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.pd-stat-num {
  font-size: 28px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.pd-stat-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.pd-section {
  padding: var(--space-6);
}

.pd-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.pd-section-title {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.pd-toggle-btn {
  background: var(--color-action-bg);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-4);
  font-size: 12px;
  color: var(--color-text-primary);
  cursor: pointer;
  font-family: inherit;
}

.pd-toggle-btn:hover {
  background: var(--color-action-bg-hover);
}

.pd-iv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  color: var(--color-text-primary);
}

.pd-iv-table th,
.pd-iv-table td {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  border-bottom: 1px solid var(--color-glass-border);
}

.pd-iv-table th {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  font-size: 11px;
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.pd-empty-text {
  color: var(--color-text-secondary);
  margin: 0;
}

.pd-qa-placeholder {
  padding: var(--space-6);
  color: var(--color-text-secondary);
}
```

- [ ] **Step 3: Type-check**

Run: `cd D:/school-business/openinteraction/client && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/pages/dashboard/ProjectDetail.tsx client/src/pages/dashboard/project-detail.css
git commit -m "feat(dashboard): scaffold ProjectDetail with overview cards and interview list"
```

---

## Task 16: `ProjectDetail` — Keyword Chips with Click-to-Prefill

**Files:**
- Modify: `client/src/pages/dashboard/ProjectDetail.tsx`
- Modify: `client/src/pages/dashboard/project-detail.css`

- [ ] **Step 1: Add chip section + prefill state**

Edit `client/src/pages/dashboard/ProjectDetail.tsx`. Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import { getProjectMetrics, type ProjectMetrics, type KeywordEntry } from '../../api/client';
import './project-detail.css';

const KEYWORD_GROUPS: Array<{ key: keyof ProjectMetrics['keywords']; title: string }> = [
  { key: 'pain_point', title: '痛点' },
  { key: 'feature_request', title: '功能诉求' },
  { key: 'positive_feedback', title: '正向反馈' },
];

function formatRate(r: number | null): string {
  return r === null ? '—' : `${(r * 100).toFixed(0)}%`;
}

function formatNum(n: number | null, suffix = ''): string {
  return n === null ? '—' : `${n.toFixed(1)}${suffix}`;
}

function ProjectDetail() {
  const { id } = useParams();
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllInterviews, setShowAllInterviews] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState('');

  useEffect(() => {
    if (!id) return;
    getProjectMetrics(id)
      .then(setMetrics)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, [id]);

  const handleChipClick = (label: string) => {
    setDraftQuestion(`为什么用户提到「${label}」？`);
    document.getElementById('pd-qa-input')?.focus();
  };

  if (error) {
    return (
      <DashboardLayout breadcrumb={<Link to="/dashboard">← 返回</Link>}>
        <p className="pd-error" role="alert">{error}</p>
      </DashboardLayout>
    );
  }

  if (!metrics) {
    return (
      <DashboardLayout breadcrumb={<Link to="/dashboard">← 返回</Link>}>
        <p className="pd-loading">加载中…</p>
      </DashboardLayout>
    );
  }

  const o = metrics.overview;
  const interviewsToShow = showAllInterviews ? metrics.interviews : metrics.interviews.slice(0, 5);

  return (
    <DashboardLayout breadcrumb={<><Link to="/dashboard">研究项目</Link> / {metrics.project.name}</>}>
      <div className="pd-grid">
        <section className="pd-left">
          <h1 className="pd-title">{metrics.project.name}</h1>

          <div className="pd-overview-row">
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{o.total}</div>
              <div className="pd-stat-label">参与人数</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatRate(o.completion_rate)}</div>
              <div className="pd-stat-label">完成率</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatNum(o.avg_duration_min, 'm')}</div>
              <div className="pd-stat-label">平均时长</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatNum(o.avg_messages_per_interview)}</div>
              <div className="pd-stat-label">平均消息数</div>
            </SurfaceCard>
          </div>

          <SurfaceCard className="pd-section">
            <h2 className="pd-section-title">关键词</h2>
            <div className="pd-chip-groups">
              {KEYWORD_GROUPS.map(g => {
                const entries: KeywordEntry[] = metrics.keywords[g.key];
                return (
                  <div key={g.key} className="pd-chip-group">
                    <h3 className="pd-chip-group-title">{g.title}</h3>
                    {entries.length === 0 ? (
                      <p className="pd-empty-text">暂无标注</p>
                    ) : (
                      <div className="pd-chips">
                        {entries.map(e => (
                          <button
                            key={e.label}
                            className="pd-chip"
                            type="button"
                            onClick={() => handleChipClick(e.label)}
                          >
                            <span className="pd-chip-label">{e.label}</span>
                            <span className="pd-chip-count">{e.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard className="pd-section">
            <header className="pd-section-header">
              <h2 className="pd-section-title">访谈记录</h2>
              {metrics.interviews.length > 5 && (
                <button
                  className="pd-toggle-btn"
                  type="button"
                  onClick={() => setShowAllInterviews(v => !v)}
                >
                  {showAllInterviews ? '收起' : `展开全部 (${metrics.interviews.length})`}
                </button>
              )}
            </header>
            {metrics.interviews.length === 0 ? (
              <p className="pd-empty-text">暂无访谈</p>
            ) : (
              <table className="pd-iv-table">
                <thead>
                  <tr>
                    <th>开始时间</th>
                    <th>状态</th>
                    <th>时长</th>
                    <th>洞察数</th>
                  </tr>
                </thead>
                <tbody>
                  {interviewsToShow.map(iv => (
                    <tr key={iv.id}>
                      <td>{iv.started_at}</td>
                      <td>{iv.status}</td>
                      <td>{iv.duration_min === null ? '—' : `${iv.duration_min.toFixed(1)}m`}</td>
                      <td>{iv.insight_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SurfaceCard>
        </section>

        <section className="pd-right">
          <SurfaceCard className="pd-qa-placeholder">
            <p>AI 问答（下一步实现）</p>
            <p className="pd-empty-text">草稿: {draftQuestion || '—'}</p>
          </SurfaceCard>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default ProjectDetail;
```

- [ ] **Step 2: Add chip styles**

Append to `client/src/pages/dashboard/project-detail.css`:

```css
.pd-chip-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.pd-chip-group-title {
  font-size: 12px;
  color: var(--color-text-secondary);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  margin: 0 0 var(--space-2);
  font-weight: var(--font-weight-medium);
}

.pd-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.pd-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-glass-tag);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
  font-family: inherit;
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-standard);
}

.pd-chip:hover {
  background: var(--color-action-bg-hover);
}

.pd-chip-count {
  background: var(--color-glass-user);
  border-radius: var(--radius-pill);
  padding: 0 var(--space-2);
  font-size: 11px;
  color: var(--color-text-strong);
  font-weight: var(--font-weight-medium);
}
```

- [ ] **Step 3: Type-check**

Run: `cd D:/school-business/openinteraction/client && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/pages/dashboard/ProjectDetail.tsx client/src/pages/dashboard/project-detail.css
git commit -m "feat(dashboard): add keyword chips with prefill on click"
```

---

## Task 17: `ProjectDetail` — Right Column AI Q&A

**Files:**
- Modify: `client/src/pages/dashboard/ProjectDetail.tsx`
- Modify: `client/src/pages/dashboard/project-detail.css`

- [ ] **Step 1: Wire up Q&A in the right column**

Edit `client/src/pages/dashboard/ProjectDetail.tsx`. Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import MessageList, { type Message } from '../../components/message-list/MessageList';
import MessageInput from '../../components/message-input/MessageInput';
import {
  getProjectMetrics,
  getDashboardChats,
  askDashboard,
  clearDashboardChats,
  type ProjectMetrics,
  type KeywordEntry,
} from '../../api/client';
import './project-detail.css';

const KEYWORD_GROUPS: Array<{ key: keyof ProjectMetrics['keywords']; title: string }> = [
  { key: 'pain_point', title: '痛点' },
  { key: 'feature_request', title: '功能诉求' },
  { key: 'positive_feedback', title: '正向反馈' },
];

function formatRate(r: number | null): string {
  return r === null ? '—' : `${(r * 100).toFixed(0)}%`;
}

function formatNum(n: number | null, suffix = ''): string {
  return n === null ? '—' : `${n.toFixed(1)}${suffix}`;
}

function ProjectDetail() {
  const { id } = useParams();
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllInterviews, setShowAllInterviews] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastTruncation, setLastTruncation] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([getProjectMetrics(id), getDashboardChats(id)])
      .then(([m, chats]) => {
        setMetrics(m);
        setChatMessages(chats.map(c => ({ role: c.role, content: c.content })));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, [id]);

  const handleChipClick = (label: string) => {
    setDraftQuestion(`为什么用户提到「${label}」？`);
    document.querySelector<HTMLTextAreaElement>('.pd-right .msg-input-field')?.focus();
  };

  const handleSend = async (text: string) => {
    if (!id) return;
    const next: Message[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(next);
    setChatLoading(true);
    setChatError(null);
    try {
      const resp = await askDashboard(id, text);
      setChatMessages([...next, { role: 'assistant', content: resp.answer }]);
      setLastTruncation(resp.truncated ? resp.dropped_count : null);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : '发送失败，请重试');
      setChatMessages(chatMessages); // roll back the user bubble
    } finally {
      setChatLoading(false);
    }
  };

  const handleClear = async () => {
    if (!id) return;
    if (!window.confirm('清空当前项目的所有问答？此操作不可撤销。')) return;
    await clearDashboardChats(id);
    setChatMessages([]);
    setLastTruncation(null);
    setChatError(null);
  };

  if (error) {
    return (
      <DashboardLayout breadcrumb={<Link to="/dashboard">← 返回</Link>}>
        <p className="pd-error" role="alert">{error}</p>
      </DashboardLayout>
    );
  }

  if (!metrics) {
    return (
      <DashboardLayout breadcrumb={<Link to="/dashboard">← 返回</Link>}>
        <p className="pd-loading">加载中…</p>
      </DashboardLayout>
    );
  }

  const o = metrics.overview;
  const interviewsToShow = showAllInterviews ? metrics.interviews : metrics.interviews.slice(0, 5);
  const noInterviews = metrics.overview.total === 0;

  return (
    <DashboardLayout breadcrumb={<><Link to="/dashboard">研究项目</Link> / {metrics.project.name}</>}>
      <div className="pd-grid">
        <section className="pd-left">
          <h1 className="pd-title">{metrics.project.name}</h1>

          <div className="pd-overview-row">
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{o.total}</div>
              <div className="pd-stat-label">参与人数</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatRate(o.completion_rate)}</div>
              <div className="pd-stat-label">完成率</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatNum(o.avg_duration_min, 'm')}</div>
              <div className="pd-stat-label">平均时长</div>
            </SurfaceCard>
            <SurfaceCard className="pd-stat-card">
              <div className="pd-stat-num">{formatNum(o.avg_messages_per_interview)}</div>
              <div className="pd-stat-label">平均消息数</div>
            </SurfaceCard>
          </div>

          <SurfaceCard className="pd-section">
            <h2 className="pd-section-title">关键词</h2>
            <div className="pd-chip-groups">
              {KEYWORD_GROUPS.map(g => {
                const entries: KeywordEntry[] = metrics.keywords[g.key];
                return (
                  <div key={g.key} className="pd-chip-group">
                    <h3 className="pd-chip-group-title">{g.title}</h3>
                    {entries.length === 0 ? (
                      <p className="pd-empty-text">暂无标注</p>
                    ) : (
                      <div className="pd-chips">
                        {entries.map(e => (
                          <button
                            key={e.label}
                            className="pd-chip"
                            type="button"
                            onClick={() => handleChipClick(e.label)}
                          >
                            <span className="pd-chip-label">{e.label}</span>
                            <span className="pd-chip-count">{e.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard className="pd-section">
            <header className="pd-section-header">
              <h2 className="pd-section-title">访谈记录</h2>
              {metrics.interviews.length > 5 && (
                <button
                  className="pd-toggle-btn"
                  type="button"
                  onClick={() => setShowAllInterviews(v => !v)}
                >
                  {showAllInterviews ? '收起' : `展开全部 (${metrics.interviews.length})`}
                </button>
              )}
            </header>
            {metrics.interviews.length === 0 ? (
              <p className="pd-empty-text">暂无访谈</p>
            ) : (
              <table className="pd-iv-table">
                <thead>
                  <tr>
                    <th>开始时间</th>
                    <th>状态</th>
                    <th>时长</th>
                    <th>洞察数</th>
                  </tr>
                </thead>
                <tbody>
                  {interviewsToShow.map(iv => (
                    <tr key={iv.id}>
                      <td>{iv.started_at}</td>
                      <td>{iv.status}</td>
                      <td>{iv.duration_min === null ? '—' : `${iv.duration_min.toFixed(1)}m`}</td>
                      <td>{iv.insight_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SurfaceCard>
        </section>

        <section className="pd-right">
          <SurfaceCard className="pd-qa-card">
            <header className="pd-qa-header">
              <h2 className="pd-section-title">问研究助手</h2>
              {chatMessages.length > 0 && (
                <button
                  type="button"
                  className="pd-toggle-btn"
                  onClick={handleClear}
                >
                  清空对话
                </button>
              )}
            </header>
            <div className="pd-qa-body">
              {noInterviews ? (
                <p className="pd-empty-text">该项目还没有访谈数据</p>
              ) : (
                <MessageList messages={chatMessages} loading={chatLoading} />
              )}
            </div>
            {lastTruncation !== null && (
              <p className="pd-qa-truncation">已基于最近 {metrics.interviews.length - lastTruncation} 次访谈回答</p>
            )}
            {chatError && <div className="pd-qa-error" role="alert">{chatError}</div>}
            <MessageInput
              onSend={handleSend}
              disabled={noInterviews || chatLoading}
              value={draftQuestion}
              onValueChange={setDraftQuestion}
            />
          </SurfaceCard>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default ProjectDetail;
```

- [ ] **Step 2: Replace placeholder styles + add Q&A styles**

Replace the `.pd-qa-placeholder` rule in `client/src/pages/dashboard/project-detail.css` and append new rules. The full `project-detail.css` should be:

```css
.pd-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 480px);
  gap: var(--space-6);
}

@media (max-width: 1280px) {
  .pd-grid {
    grid-template-columns: 1fr;
  }
}

.pd-left,
.pd-right {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 0;
}

.pd-title {
  font-size: 26px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: var(--letter-spacing-tight);
}

.pd-loading,
.pd-error {
  color: var(--color-text-secondary);
}

.pd-overview-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.pd-stat-card {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.pd-stat-num {
  font-size: 28px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.pd-stat-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.pd-section {
  padding: var(--space-6);
}

.pd-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.pd-section-title {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.pd-toggle-btn {
  background: var(--color-action-bg);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-4);
  font-size: 12px;
  color: var(--color-text-primary);
  cursor: pointer;
  font-family: inherit;
}

.pd-toggle-btn:hover {
  background: var(--color-action-bg-hover);
}

.pd-iv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  color: var(--color-text-primary);
}

.pd-iv-table th,
.pd-iv-table td {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  border-bottom: 1px solid var(--color-glass-border);
}

.pd-iv-table th {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  font-size: 11px;
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.pd-empty-text {
  color: var(--color-text-secondary);
  margin: 0;
}

.pd-chip-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.pd-chip-group-title {
  font-size: 12px;
  color: var(--color-text-secondary);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  margin: 0 0 var(--space-2);
  font-weight: var(--font-weight-medium);
}

.pd-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.pd-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-glass-tag);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
  font-family: inherit;
  font-size: 13px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-standard);
}

.pd-chip:hover {
  background: var(--color-action-bg-hover);
}

.pd-chip-count {
  background: var(--color-glass-user);
  border-radius: var(--radius-pill);
  padding: 0 var(--space-2);
  font-size: 11px;
  color: var(--color-text-strong);
  font-weight: var(--font-weight-medium);
}

.pd-qa-card {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 180px);
  min-height: 600px;
  padding: var(--space-5);
  gap: var(--space-3);
}

.pd-qa-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pd-qa-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pd-qa-truncation {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-style: italic;
  margin: 0;
}

.pd-qa-error {
  color: #8a4a4a;
  background: var(--color-glass);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: 13px;
}
```

- [ ] **Step 3: Type-check**

Run: `cd D:/school-business/openinteraction/client && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/pages/dashboard/ProjectDetail.tsx client/src/pages/dashboard/project-detail.css
git commit -m "feat(dashboard): wire AI Q&A panel with history, send, clear"
```

---

## Task 18: Router Wiring + End-to-End Manual Verification

**Files:**
- Modify: `client/src/router.tsx`

- [ ] **Step 1: Add routes**

Edit `client/src/router.tsx`. Replace its contents with:

```tsx
import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/home/HomePage';
import LandingPage from './pages/landing/LandingPage';
import ChatPage from './pages/chat/ChatPage';
import CompletePage from './pages/complete/CompletePage';
import DashboardHome from './pages/dashboard/DashboardHome';
import ProjectDetail from './pages/dashboard/ProjectDetail';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/interview/:token',
    element: <LandingPage />,
  },
  {
    path: '/interview/:token/chat',
    element: <ChatPage />,
  },
  {
    path: '/interview/:token/complete',
    element: <CompletePage />,
  },
  {
    path: '/dashboard',
    element: <DashboardHome />,
  },
  {
    path: '/dashboard/projects/:id',
    element: <ProjectDetail />,
  },
  {
    path: '*',
    element: <HomePage />,
  },
]);
```

- [ ] **Step 2: Type-check**

Run: `cd D:/school-business/openinteraction/client && npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Run full server test suite**

Run: `cd D:/school-business/openinteraction/server && npm test`
Expected: all tests pass.

- [ ] **Step 4: End-to-end manual verification**

Start both servers:

```bash
# terminal 1
cd D:/school-business/openinteraction/server && npm run dev
# terminal 2
cd D:/school-business/openinteraction/client && npm run dev
```

Walk through the success-criteria checklist:

1. **Project list** — open `http://localhost:5173/dashboard`. Verify all existing projects appear as cards with name, relative time, and three numeric badges (total / completed / avg duration). If a project has no completed interviews, the duration shows `—`.
2. **Project detail navigation** — click a card. URL becomes `/dashboard/projects/<id>`. Page shows project name, four stat cards, three keyword groups (`痛点 / 功能诉求 / 正向反馈`), and the interview list (default 5 rows).
3. **Chip prefill** — click any chip. The right-column input is populated with `为什么用户提到「<label>」？` and the focus moves to the textarea.
4. **Q&A round-trip** — type a question (e.g., `主要痛点是什么？`) and send. Loading dots appear. The reply arrives. Refresh the page — both turns are still visible.
5. **Citations** — for a project with `≥ 5` interviews, ask `主要痛点是什么？` and `有谁提到搜索很慢？`. Verify the AI response uses `>` quote blocks and the quoted strings exist in `messages.content` for that project (check via SQL: `SELECT content FROM messages WHERE interview_id IN (SELECT id FROM interviews WHERE project_id = '<id>')`).
6. **Clear conversation** — click "清空对话". Confirm the prompt. Conversation empties; reload — still empty.
7. **Empty project** — create a new project (via the existing interview-create flow) but skip running any interviews. Open its detail page. Confirm: stats show `0 / — / — / —`, all chip groups show `暂无标注`, the right column shows `该项目还没有访谈数据` and the input is disabled.
8. **Receiver flow regression** — open `http://localhost:5173/interview/<existing-token>` and complete a short chat. Verify nothing broke for the interviewee.

If any step fails, capture the error, file a follow-up task, and return to the offending task before committing the next step.

- [ ] **Step 5: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/router.tsx
git commit -m "feat(dashboard): wire /dashboard routes and complete end-to-end flow"
```

---

## Done Criteria

- All 18 tasks committed.
- `npm test` in `server/` passes with no failures and matching/exceeding the existing coverage on the new files.
- The eight manual verification steps in Task 18 all pass on a real database.
- Receiver-side flow (`/interview/...`) is regression-free.
