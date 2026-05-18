# Dashboard Analytics Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `DashboardHome` with a cross-project Analytics overview (sidebar + KPI row + frequency chart + trending tags + recent interviews table); move the project list to `/dashboard/projects`.

**Architecture:** One new backend service function (`getDashboardOverview`) exposed at `GET /api/dashboard/overview`. Frontend gains three pages (`AnalyticsOverview`, `ProjectsList`, plus the existing `ProjectDetail`/`CreateProject`), a sidebar component, and a reusable inline-SVG `Sparkline`. `DashboardLayout` is restructured from a top-only header to a left sidebar + main column. No new dependencies, no schema changes.

**Tech Stack:** Node.js + Express + better-sqlite3 (server), React + Vite + TypeScript (client), vitest + supertest for backend tests. The frontend has no test harness today and none is added here.

**Reference spec:** `docs/superpowers/specs/2026-05-18-dashboard-analytics-overview-design.md`

---

## File Structure

### Backend (server/)

| Path | Action | Responsibility |
|---|---|---|
| `src/services/metricsService.js` | Modify | Add `getDashboardOverview(db)`, returns full overview object |
| `src/routes/dashboard.js` | Modify | Add `GET /overview` |
| `tests/services/metricsService.test.js` | Modify | Add `describe('getDashboardOverview', …)` block |
| `tests/routes/dashboard.test.js` | Modify | Add `describe('GET /api/dashboard/overview', …)` block |

### Frontend (client/)

| Path | Action | Responsibility |
|---|---|---|
| `src/styles/tokens.css` | Modify | Add 4 success/status tokens |
| `src/api/client.ts` | Modify | Add `DashboardOverview` interface + `getDashboardOverview()` |
| `src/components/charts/Sparkline.tsx` | Create | Reusable inline-SVG line chart |
| `src/components/charts/sparkline.css` | Create | Sparkline styles |
| `src/components/dashboard-layout/Sidebar.tsx` | Create | Icon-only left rail |
| `src/components/dashboard-layout/sidebar.css` | Create | Sidebar styles |
| `src/components/dashboard-layout/DashboardLayout.tsx` | Modify | Switch to sidebar + main grid |
| `src/components/dashboard-layout/dashboard-layout.css` | Modify | Rewrite layout rules |
| `src/pages/dashboard/ProjectsList.tsx` | Create | Project cards grid (lifted from old DashboardHome) |
| `src/pages/dashboard/projects-list.css` | Create | Project cards styles (lifted) |
| `src/pages/dashboard/AnalyticsOverview.tsx` | Create | KPIs + chart + tags + recent table |
| `src/pages/dashboard/analytics-overview.css` | Create | Overview-page styles |
| `src/pages/dashboard/DashboardHome.tsx` | Delete | Replaced by AnalyticsOverview + ProjectsList |
| `src/pages/dashboard/dashboard-home.css` | Delete | Styles redistributed |
| `src/router.tsx` | Modify | Replace DashboardHome import; add `/dashboard/projects` route |

---

## Task 1: `getDashboardOverview` — counts (TDD)

**Files:**
- Test: `server/tests/services/metricsService.test.js` (modify — append new describe block)
- Modify: `server/src/services/metricsService.js`

The service file already has `getProjectsOverview` and `getProjectMetrics`. Existing test file uses helpers `insertProject(name)` and `insertInterview(projectId, status, startedAt, endedAt)` which are reusable.

- [ ] **Step 1: Write the failing tests**

Append to the bottom of `server/tests/services/metricsService.test.js` (after the `getProjectMetrics` describe block, keep `insertProject`/`insertInterview` helpers in scope):

```js
import { getDashboardOverview } from '../../src/services/metricsService.js';

describe('getDashboardOverview — counts', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('returns zero counts on empty database', () => {
    const o = getDashboardOverview(getDb());
    expect(o.total_interviews).toBe(0);
    expect(o.in_progress_interviews).toBe(0);
    expect(o.total_projects).toBe(0);
  });

  it('counts projects, total interviews, and in_progress interviews', () => {
    const p1 = insertProject('A');
    const p2 = insertProject('B');
    insertInterview(p1, 'completed', '2026-05-01 10:00:00', '2026-05-01 10:10:00');
    insertInterview(p1, 'in_progress', '2026-05-02 10:00:00', null);
    insertInterview(p2, 'in_progress', '2026-05-03 10:00:00', null);
    insertInterview(p2, 'abandoned', '2026-05-04 10:00:00', null);

    const o = getDashboardOverview(getDb());
    expect(o.total_projects).toBe(2);
    expect(o.total_interviews).toBe(4);
    expect(o.in_progress_interviews).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/services/metricsService.test.js
```

Expected: FAIL with `getDashboardOverview is not a function` or import error.

- [ ] **Step 3: Implement minimal version**

Append to `server/src/services/metricsService.js`:

```js
export function getDashboardOverview(db) {
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM projects) AS total_projects,
      (SELECT COUNT(*) FROM interviews) AS total_interviews,
      (SELECT COUNT(*) FROM interviews WHERE status = 'in_progress') AS in_progress_interviews
  `).get();

  return {
    total_projects: totals.total_projects,
    total_interviews: totals.total_interviews,
    in_progress_interviews: totals.in_progress_interviews,
    interview_growth_pct: null,
    monthly_interviews: [],
    trending_tags: [],
    total_keyword_count: 0,
    recent_interviews: [],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/services/metricsService.test.js
```

Expected: all 3 new tests pass; pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/metricsService.js server/tests/services/metricsService.test.js
git commit -m "feat(metrics): add getDashboardOverview counts"
```

---

## Task 2: `getDashboardOverview` — `interview_growth_pct`

**Files:**
- Test: `server/tests/services/metricsService.test.js` (append new describe)
- Modify: `server/src/services/metricsService.js`

- [ ] **Step 1: Write the failing tests**

Append:

```js
describe('getDashboardOverview — growth_pct', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  function thisMonth(day) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} 10:00:00`;
  }

  function lastMonth(day) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} 10:00:00`;
  }

  it('returns null when previous month has zero interviews', () => {
    const p = insertProject('A');
    insertInterview(p, 'completed', thisMonth(1), thisMonth(1));
    insertInterview(p, 'completed', thisMonth(2), thisMonth(2));

    const o = getDashboardOverview(getDb());
    expect(o.interview_growth_pct).toBeNull();
  });

  it('computes growth percent rounded to integer', () => {
    const p = insertProject('A');
    for (let i = 1; i <= 10; i++) insertInterview(p, 'completed', lastMonth(i), lastMonth(i));
    for (let i = 1; i <= 12; i++) insertInterview(p, 'completed', thisMonth(i), thisMonth(i));

    const o = getDashboardOverview(getDb());
    expect(o.interview_growth_pct).toBe(20);
  });

  it('handles negative growth', () => {
    const p = insertProject('A');
    for (let i = 1; i <= 10; i++) insertInterview(p, 'completed', lastMonth(i), lastMonth(i));
    for (let i = 1; i <= 5; i++) insertInterview(p, 'completed', thisMonth(i), thisMonth(i));

    const o = getDashboardOverview(getDb());
    expect(o.interview_growth_pct).toBe(-50);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/services/metricsService.test.js
```

Expected: 2 of the 3 new tests FAIL (the null one already passes). Failure: `expect(null).toBe(20)`.

- [ ] **Step 3: Implement growth_pct**

In `server/src/services/metricsService.js`, replace the `getDashboardOverview` body with:

```js
export function getDashboardOverview(db) {
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM projects) AS total_projects,
      (SELECT COUNT(*) FROM interviews) AS total_interviews,
      (SELECT COUNT(*) FROM interviews WHERE status = 'in_progress') AS in_progress_interviews
  `).get();

  const growth = db.prepare(`
    SELECT
      SUM(CASE WHEN strftime('%Y-%m', started_at) = strftime('%Y-%m', 'now') THEN 1 ELSE 0 END) AS this_month,
      SUM(CASE WHEN strftime('%Y-%m', started_at) = strftime('%Y-%m', 'now', '-1 month') THEN 1 ELSE 0 END) AS last_month
    FROM interviews
  `).get();

  const lastM = growth.last_month || 0;
  const thisM = growth.this_month || 0;
  const interview_growth_pct = lastM === 0 ? null : Math.round(((thisM - lastM) / lastM) * 100);

  return {
    total_projects: totals.total_projects,
    total_interviews: totals.total_interviews,
    in_progress_interviews: totals.in_progress_interviews,
    interview_growth_pct,
    monthly_interviews: [],
    trending_tags: [],
    total_keyword_count: 0,
    recent_interviews: [],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/services/metricsService.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/metricsService.js server/tests/services/metricsService.test.js
git commit -m "feat(metrics): add interview_growth_pct to dashboard overview"
```

---

## Task 3: `getDashboardOverview` — `monthly_interviews` (7 buckets, zero-fill)

**Files:**
- Test: `server/tests/services/metricsService.test.js` (append new describe)
- Modify: `server/src/services/metricsService.js`

- [ ] **Step 1: Write the failing tests**

Append:

```js
describe('getDashboardOverview — monthly_interviews', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('returns 7 month buckets ordered ascending including current month', () => {
    const o = getDashboardOverview(getDb());
    expect(o.monthly_interviews).toHaveLength(7);

    const months = o.monthly_interviews.map(b => b.month);
    const sorted = [...months].sort();
    expect(months).toEqual(sorted);

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(months[months.length - 1]).toBe(currentMonth);

    for (const b of o.monthly_interviews) expect(b.count).toBe(0);
  });

  it('zero-fills empty months and counts present months', () => {
    const p = insertProject('A');
    const now = new Date();
    const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    insertInterview(p, 'completed', `${m}-01 10:00:00`, `${m}-01 10:10:00`);
    insertInterview(p, 'completed', `${m}-02 10:00:00`, `${m}-02 10:10:00`);
    insertInterview(p, 'completed', `${m}-03 10:00:00`, `${m}-03 10:10:00`);

    const o = getDashboardOverview(getDb());
    const last = o.monthly_interviews[o.monthly_interviews.length - 1];
    expect(last.month).toBe(m);
    expect(last.count).toBe(3);

    const earlier = o.monthly_interviews.slice(0, -1);
    for (const b of earlier) expect(b.count).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/services/metricsService.test.js
```

Expected: FAIL — `monthly_interviews` is `[]`.

- [ ] **Step 3: Implement zero-filled monthly buckets**

In `getDashboardOverview`, before the `return`, insert:

```js
  const monthlyRows = db.prepare(`
    SELECT strftime('%Y-%m', started_at) AS month, COUNT(*) AS count
    FROM interviews
    WHERE started_at >= date('now', 'start of month', '-6 months')
    GROUP BY month
  `).all();

  const monthlyMap = new Map(monthlyRows.map(r => [r.month, r.count]));
  const monthly_interviews = [];
  const ref = new Date();
  ref.setDate(1);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthly_interviews.push({ month: key, count: monthlyMap.get(key) || 0 });
  }
```

Then change `monthly_interviews: [],` in the returned object to `monthly_interviews,`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/services/metricsService.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/metricsService.js server/tests/services/metricsService.test.js
git commit -m "feat(metrics): add monthly_interviews 7-bucket zero-filled series"
```

---

## Task 4: `getDashboardOverview` — `trending_tags` + `total_keyword_count`

**Files:**
- Test: `server/tests/services/metricsService.test.js` (append new describe)
- Modify: `server/src/services/metricsService.js`

The existing test file already defines an `insertAnnotation(interviewId, category, label, severity)` helper above the `getProjectMetrics` describe block — reuse it.

- [ ] **Step 1: Write the failing tests**

Append:

```js
describe('getDashboardOverview — trending_tags', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('returns top tags sorted by count desc with label asc tie-break', () => {
    const p = insertProject('A');
    const i = insertInterview(p, 'completed', '2026-05-01 10:00:00', '2026-05-01 10:10:00');

    insertAnnotation(i, 'pain_point', 'Onboarding');
    insertAnnotation(i, 'pain_point', 'Onboarding');
    insertAnnotation(i, 'pain_point', 'Onboarding');
    insertAnnotation(i, 'pain_point', 'Navigation');
    insertAnnotation(i, 'feature_request', 'Mobile');
    insertAnnotation(i, 'feature_request', 'Mobile');
    insertAnnotation(i, 'positive_feedback', 'Speed');
    insertAnnotation(i, 'positive_feedback', 'Search');

    const o = getDashboardOverview(getDb());
    expect(o.trending_tags[0]).toEqual({ label: 'Onboarding', count: 3 });
    expect(o.trending_tags[1]).toEqual({ label: 'Mobile', count: 2 });
    expect(o.trending_tags[2]).toEqual({ label: 'Navigation', count: 1 });
    expect(o.trending_tags[3]).toEqual({ label: 'Search', count: 1 });
    expect(o.trending_tags[4]).toEqual({ label: 'Speed', count: 1 });
    expect(o.total_keyword_count).toBe(5);
  });

  it('caps trending_tags at 9 entries', () => {
    const p = insertProject('A');
    const i = insertInterview(p, 'completed', '2026-05-01 10:00:00', '2026-05-01 10:10:00');
    for (let n = 0; n < 12; n++) insertAnnotation(i, 'pain_point', `tag-${String(n).padStart(2, '0')}`);

    const o = getDashboardOverview(getDb());
    expect(o.trending_tags).toHaveLength(9);
    expect(o.total_keyword_count).toBe(12);
  });

  it('returns empty arrays when no annotations', () => {
    const o = getDashboardOverview(getDb());
    expect(o.trending_tags).toEqual([]);
    expect(o.total_keyword_count).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/services/metricsService.test.js
```

Expected: FAIL — `trending_tags` is `[]`.

- [ ] **Step 3: Implement trending_tags + total_keyword_count**

In `getDashboardOverview`, before the `return`, insert:

```js
  const trending_tags = db.prepare(`
    SELECT label, COUNT(*) AS count
    FROM annotations
    GROUP BY label
    ORDER BY count DESC, label ASC
    LIMIT 9
  `).all();

  const totalKw = db.prepare('SELECT COUNT(DISTINCT label) AS c FROM annotations').get();
  const total_keyword_count = totalKw.c;
```

Replace `trending_tags: [],` and `total_keyword_count: 0,` in the returned object with `trending_tags,` and `total_keyword_count,`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/services/metricsService.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/metricsService.js server/tests/services/metricsService.test.js
git commit -m "feat(metrics): add trending_tags and total_keyword_count"
```

---

## Task 5: `getDashboardOverview` — `recent_interviews`

**Files:**
- Test: `server/tests/services/metricsService.test.js` (append new describe)
- Modify: `server/src/services/metricsService.js`

- [ ] **Step 1: Write the failing tests**

Append:

```js
describe('getDashboardOverview — recent_interviews', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('returns rows ordered by started_at desc with project_name and short_id', () => {
    const p = insertProject('Alpha');
    const i1 = insertInterview(p, 'completed', '2026-05-01 10:00:00', '2026-05-01 10:10:00');
    const i2 = insertInterview(p, 'in_progress', '2026-05-02 10:00:00', null);

    const o = getDashboardOverview(getDb());
    expect(o.recent_interviews).toHaveLength(2);
    expect(o.recent_interviews[0].id).toBe(i2);
    expect(o.recent_interviews[1].id).toBe(i1);
    expect(o.recent_interviews[0].project_name).toBe('Alpha');
    expect(o.recent_interviews[0].project_id).toBe(p);
    expect(o.recent_interviews[0].status).toBe('in_progress');
    expect(o.recent_interviews[0].short_id).toBe(`INT-${i2.slice(0, 4)}`);
    expect(o.recent_interviews[0].started_at).toBe('2026-05-02 10:00:00');
  });

  it('caps recent_interviews at 20 rows', () => {
    const p = insertProject('Alpha');
    for (let n = 0; n < 25; n++) {
      const day = String(n + 1).padStart(2, '0');
      insertInterview(p, 'completed', `2026-05-${day} 10:00:00`, `2026-05-${day} 10:10:00`);
    }
    const o = getDashboardOverview(getDb());
    expect(o.recent_interviews).toHaveLength(20);
  });

  it('returns empty array when no interviews', () => {
    const o = getDashboardOverview(getDb());
    expect(o.recent_interviews).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/services/metricsService.test.js
```

Expected: FAIL — `recent_interviews` is `[]`.

- [ ] **Step 3: Implement recent_interviews**

In `getDashboardOverview`, before the `return`, insert:

```js
  const recentRows = db.prepare(`
    SELECT
      i.id AS id,
      i.project_id AS project_id,
      p.name AS project_name,
      i.status AS status,
      i.started_at AS started_at
    FROM interviews i
    JOIN projects p ON p.id = i.project_id
    ORDER BY i.started_at DESC
    LIMIT 20
  `).all();

  const recent_interviews = recentRows.map(r => ({
    ...r,
    short_id: `INT-${r.id.slice(0, 4)}`,
  }));
```

Replace `recent_interviews: [],` with `recent_interviews,`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/services/metricsService.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/metricsService.js server/tests/services/metricsService.test.js
git commit -m "feat(metrics): add recent_interviews list to dashboard overview"
```

---

## Task 6: `GET /api/dashboard/overview` route

**Files:**
- Test: `server/tests/routes/dashboard.test.js` (append new describe)
- Modify: `server/src/routes/dashboard.js`

- [ ] **Step 1: Write the failing test**

Append to `server/tests/routes/dashboard.test.js`:

```js
describe('Dashboard routes — overview', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('GET /api/dashboard/overview returns documented shape with empty data', async () => {
    const res = await request(app).get('/api/dashboard/overview').expect(200);
    expect(res.body).toMatchObject({
      total_interviews: 0,
      in_progress_interviews: 0,
      total_projects: 0,
      interview_growth_pct: null,
      total_keyword_count: 0,
      trending_tags: [],
      recent_interviews: [],
    });
    expect(res.body.monthly_interviews).toHaveLength(7);
  });

  it('GET /api/dashboard/overview reflects inserted data', async () => {
    const db = getDb();
    const pid = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      pid, 'P1', 'ctx', '[]'
    );
    const iid = uuid();
    db.prepare('INSERT INTO interviews (id, project_id, share_token, status, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      iid, pid, uuid(), 'in_progress', '2026-05-01 10:00:00', null
    );

    const res = await request(app).get('/api/dashboard/overview').expect(200);
    expect(res.body.total_projects).toBe(1);
    expect(res.body.total_interviews).toBe(1);
    expect(res.body.in_progress_interviews).toBe(1);
    expect(res.body.recent_interviews).toHaveLength(1);
    expect(res.body.recent_interviews[0].project_name).toBe('P1');
    expect(res.body.recent_interviews[0].short_id).toBe(`INT-${iid.slice(0, 4)}`);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/routes/dashboard.test.js
```

Expected: FAIL — 404 (route not registered).

- [ ] **Step 3: Add the import and route**

In `server/src/routes/dashboard.js`:

Update the existing import line to include `getDashboardOverview`:

```js
import { getProjectsOverview, getProjectMetrics, getDashboardOverview } from '../services/metricsService.js';
```

Add a new route below the existing `router.get('/projects', …)`:

```js
router.get('/overview', (req, res) => {
  res.json(getDashboardOverview(getDb()));
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/routes/dashboard.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Run the full server test suite to confirm no regression**

```bash
cd server && npm test
```

Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/dashboard.js server/tests/routes/dashboard.test.js
git commit -m "feat(dashboard): add GET /api/dashboard/overview"
```

---

## Task 7: Add design tokens

**Files:**
- Modify: `client/src/styles/tokens.css`

- [ ] **Step 1: Add new tokens**

Inside the `:root { … }` block in `client/src/styles/tokens.css`, append immediately before the closing `}` (after the existing `--letter-spacing-tight` line):

```css

  /* === 状态徽章（dashboard analytics overview） === */
  --color-success-bg: rgba(150, 200, 150, 0.25);
  --color-success-text: #3b6b3b;
  --color-status-active: rgba(255, 255, 255, 0.85);
  --color-status-warn-bg: rgba(255, 255, 255, 0.6);
```

- [ ] **Step 2: Verify the file parses by typechecking the client**

```bash
cd client && npx tsc --noEmit
```

Expected: exits 0 (the tokens file isn't TS but this catches any cascading import breakage).

- [ ] **Step 3: Commit**

```bash
git add client/src/styles/tokens.css
git commit -m "feat(styles): add success and status tokens for analytics overview"
```

---

## Task 8: API client — `getDashboardOverview()`

**Files:**
- Modify: `client/src/api/client.ts`

- [ ] **Step 1: Add the type and the function**

In `client/src/api/client.ts`, after the existing `ProjectMetrics` interface (around line 87) and before `DashboardChat`, insert:

```ts
export interface MonthlyInterviewBucket {
  month: string;
  count: number;
}

export interface RecentInterviewRow {
  id: string;
  short_id: string;
  project_id: string;
  project_name: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
}

export interface DashboardOverview {
  total_interviews: number;
  in_progress_interviews: number;
  total_projects: number;
  interview_growth_pct: number | null;
  monthly_interviews: MonthlyInterviewBucket[];
  trending_tags: Array<{ label: string; count: number }>;
  total_keyword_count: number;
  recent_interviews: RecentInterviewRow[];
}
```

After the existing `listProjects` function (around line 104), insert:

```ts
export function getDashboardOverview(): Promise<DashboardOverview> {
  return request<DashboardOverview>('/dashboard/overview');
}
```

- [ ] **Step 2: Typecheck**

```bash
cd client && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add client/src/api/client.ts
git commit -m "feat(api): add getDashboardOverview client method"
```

---

## Task 9: `Sparkline` component

**Files:**
- Create: `client/src/components/charts/Sparkline.tsx`
- Create: `client/src/components/charts/sparkline.css`

- [ ] **Step 1: Create the CSS file**

Create `client/src/components/charts/sparkline.css`:

```css
.sparkline-root {
  position: relative;
  width: 100%;
  height: 100%;
}

.sparkline-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.sparkline-line {
  fill: none;
  stroke: var(--color-glass-border);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: sparkline-dash 3s linear forwards;
}

.sparkline-line--empty {
  animation: none;
  stroke-dasharray: 4 4;
  stroke-dashoffset: 0;
  opacity: 0.5;
}

.sparkline-area {
  fill: rgba(255, 255, 255, 0.05);
}

.sparkline-label {
  fill: rgba(0, 0, 0, 0.3);
  font-size: 10px;
}

.sparkline-empty-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: 12px;
  pointer-events: none;
}

@keyframes sparkline-dash {
  to { stroke-dashoffset: 0; }
}
```

- [ ] **Step 2: Create the component**

Create `client/src/components/charts/Sparkline.tsx`:

```tsx
import './sparkline.css';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface SparklineProps {
  points: Array<{ month: string; count: number }>;
  emptyText?: string;
}

function monthLabel(monthKey: string): string {
  const idx = parseInt(monthKey.slice(5), 10) - 1;
  return MONTH_NAMES[idx] ?? monthKey;
}

function buildPath(points: Array<{ count: number }>, width: number, lineY: number, baseY: number): { line: string; area: string } {
  if (points.length === 0) return { line: '', area: '' };
  const maxV = Math.max(1, ...points.map(p => p.count));
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: lineY - (p.count / maxV) * lineY,
  }));

  let line = `M${coords[0].x},${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cx = (prev.x + curr.x) / 2;
    line += ` C${cx},${prev.y} ${cx},${curr.y} ${curr.x},${curr.y}`;
  }
  const area = `${line} L${coords[coords.length - 1].x},${baseY} L${coords[0].x},${baseY} Z`;
  return { line, area };
}

function Sparkline({ points, emptyText = 'Waiting for first interviews' }: SparklineProps) {
  const allZero = points.every(p => p.count === 0);
  const width = 800;
  const height = 120;
  const lineY = 100;
  const baseY = 120;

  const { line, area } = buildPath(points, width, lineY, baseY);

  return (
    <div className="sparkline-root">
      <svg viewBox={`0 0 ${width} ${height}`} className="sparkline-svg" preserveAspectRatio="none">
        {!allZero && line && (
          <>
            <path d={area} className="sparkline-area" />
            <path d={line} className="sparkline-line" />
          </>
        )}
        {allZero && (
          <line x1="0" y1={lineY / 2 + 20} x2={width} y2={lineY / 2 + 20} className="sparkline-line sparkline-line--empty" />
        )}
        {points.map((p, i) => {
          const stepX = points.length > 1 ? width / (points.length - 1) : 0;
          return (
            <text key={p.month} x={i * stepX} y={height - 5} className="sparkline-label">
              {monthLabel(p.month)}
            </text>
          );
        })}
      </svg>
      {allZero && <div className="sparkline-empty-text">{emptyText}</div>}
    </div>
  );
}

export default Sparkline;
```

- [ ] **Step 3: Typecheck**

```bash
cd client && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/charts/Sparkline.tsx client/src/components/charts/sparkline.css
git commit -m "feat(charts): add Sparkline component"
```

---

## Task 10: `Sidebar` component

**Files:**
- Create: `client/src/components/dashboard-layout/Sidebar.tsx`
- Create: `client/src/components/dashboard-layout/sidebar.css`

- [ ] **Step 1: Create the CSS file**

Create `client/src/components/dashboard-layout/sidebar.css`:

```css
.dash-sidebar {
  width: 80px;
  flex-shrink: 0;
  background: var(--color-glass);
  backdrop-filter: var(--blur-card);
  -webkit-backdrop-filter: var(--blur-card);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-bubble);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8) 0;
  gap: var(--space-10);
  box-shadow: var(--shadow-card);
}

.dash-sidebar-logo {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--color-glass-user);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary);
}

.dash-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  flex: 1;
}

.dash-sidebar-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  text-decoration: none;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-standard),
              color var(--duration-fast) var(--ease-standard);
}

.dash-sidebar-link:hover {
  background: var(--color-glass-hover);
  color: var(--color-text-primary);
}

.dash-sidebar-link.is-active {
  background: var(--color-glass-user);
  color: var(--color-text-primary);
}

.dash-sidebar-link.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dash-sidebar-link.is-disabled:hover {
  background: transparent;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 2: Create the component**

Create `client/src/components/dashboard-layout/Sidebar.tsx`:

```tsx
import { NavLink, useLocation } from 'react-router-dom';
import './sidebar.css';

function Sidebar() {
  const location = useLocation();
  const overviewActive = location.pathname === '/dashboard';

  return (
    <aside className="dash-sidebar" aria-label="Dashboard navigation">
      <div className="dash-sidebar-logo" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9Z" />
          <path d="M9 17v-4a3 3 0 0 1 6 0v4" />
        </svg>
      </div>

      <nav className="dash-sidebar-nav">
        <NavLink
          to="/dashboard"
          className={() => `dash-sidebar-link${overviewActive ? ' is-active' : ''}`}
          end
          aria-label="Overview"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
        </NavLink>

        <NavLink
          to="/dashboard/projects"
          className={({ isActive }) => `dash-sidebar-link${isActive ? ' is-active' : ''}`}
          aria-label="Projects"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </NavLink>
      </nav>

      <span className="dash-sidebar-link is-disabled" aria-label="Settings (coming soon)" aria-disabled="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </span>
    </aside>
  );
}

export default Sidebar;
```

- [ ] **Step 3: Typecheck**

```bash
cd client && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/dashboard-layout/Sidebar.tsx client/src/components/dashboard-layout/sidebar.css
git commit -m "feat(dashboard): add Sidebar component"
```

---

## Task 11: Refactor `DashboardLayout` to sidebar + main grid

**Files:**
- Modify: `client/src/components/dashboard-layout/DashboardLayout.tsx`
- Modify: `client/src/components/dashboard-layout/dashboard-layout.css`

- [ ] **Step 1: Replace DashboardLayout.tsx**

Overwrite `client/src/components/dashboard-layout/DashboardLayout.tsx`:

```tsx
import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import './dashboard-layout.css';

interface DashboardLayoutProps {
  title?: string;
  subtitle?: string;
  breadcrumb?: ReactNode;
  children: ReactNode;
}

function DashboardLayout({ title, subtitle, breadcrumb, children }: DashboardLayoutProps) {
  return (
    <div className="dash-layout">
      <Sidebar />
      <div className="dash-column">
        <header className="dash-header">
          <div className="dash-header-titles">
            {title && <h1 className="dash-header-title">{title}</h1>}
            {subtitle && <p className="dash-header-subtitle">{subtitle}</p>}
          </div>
          <div className="dash-header-meta">
            {breadcrumb && <nav className="dash-breadcrumb">{breadcrumb}</nav>}
            <Link to="/dashboard" className="dash-brand">
              <span className="dash-brand-dot" />
              <span className="dash-brand-text">研究面板</span>
            </Link>
          </div>
        </header>
        <main className="dash-main">{children}</main>
      </div>
    </div>
  );
}

export default DashboardLayout;
```

- [ ] **Step 2: Replace dashboard-layout.css**

Overwrite `client/src/components/dashboard-layout/dashboard-layout.css`:

```css
.dash-layout {
  min-height: 100dvh;
  display: flex;
  align-items: stretch;
  gap: var(--space-6);
  padding: var(--space-6);
}

.dash-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-2) var(--space-2) var(--space-6);
}

.dash-header-titles {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.dash-header-title {
  font-size: 28px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: var(--letter-spacing-tight);
  margin: 0;
}

.dash-header-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

.dash-header-meta {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.dash-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-tight);
  background: var(--color-glass);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-pill);
  padding: var(--space-2) var(--space-4);
}

.dash-brand-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-circle);
  background: var(--color-glass-user);
  border: 1px solid var(--color-glass-border);
  box-shadow: var(--shadow-dot);
}

.dash-brand-text {
  font-size: 13px;
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
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  min-width: 0;
}
```

- [ ] **Step 3: Typecheck**

```bash
cd client && npx tsc --noEmit
```

Expected: exits 0.

Note: this changes the `DashboardLayout` props (adds `title`, `subtitle`). Existing call sites (`DashboardHome`, `ProjectDetail`, `CreateProject`) still compile because both new props are optional. They'll be passed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/dashboard-layout/DashboardLayout.tsx client/src/components/dashboard-layout/dashboard-layout.css
git commit -m "refactor(dashboard): convert layout to sidebar + main grid"
```

---

## Task 12: `ProjectsList` component (lifted from old DashboardHome)

**Files:**
- Create: `client/src/pages/dashboard/ProjectsList.tsx`
- Create: `client/src/pages/dashboard/projects-list.css`

This is mostly a copy/move from `DashboardHome.tsx` and `dashboard-home.css`. The old files are deleted later in Task 16.

- [ ] **Step 1: Create the CSS file**

Create `client/src/pages/dashboard/projects-list.css` with the project-grid styles from the existing `dashboard-home.css`, prefixed `pl-` instead of `dh-`:

```css
.pl-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.pl-loading,
.pl-error {
  color: var(--color-text-secondary);
}

.pl-error {
  color: #8a4a4a;
}

.pl-empty {
  padding: var(--space-8);
  color: var(--color-text-secondary);
}

.pl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-5);
}

.pl-card-link {
  text-decoration: none;
}

.pl-card {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: background var(--duration-fast) var(--ease-standard);
}

.pl-card-link:hover .pl-card {
  background: var(--color-glass-hover);
}

.pl-card-name {
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.pl-card-time {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 0;
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.pl-card-stats {
  display: flex;
  gap: var(--space-5);
  margin-top: var(--space-2);
}

.pl-stat-num {
  font-size: 22px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.pl-stat-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.pl-create-btn {
  padding: var(--space-3) var(--space-5);
  background: var(--color-action-bg-primary);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: background var(--duration-fast) var(--ease-standard);
}

.pl-create-btn:hover {
  background: var(--color-action-bg-hover);
}
```

- [ ] **Step 2: Create the component**

Create `client/src/pages/dashboard/ProjectsList.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import { listProjects, type ProjectOverview } from '../../api/client';
import './projects-list.css';

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

function ProjectsList() {
  const [projects, setProjects] = useState<ProjectOverview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, []);

  return (
    <DashboardLayout title="研究项目" subtitle="按项目浏览所有访谈活动">
      <div className="pl-header-row">
        <span />
        <Link to="/dashboard/create" className="pl-create-btn">新建项目</Link>
      </div>
      {error && <p className="pl-error" role="alert">{error}</p>}
      {projects === null && !error && <p className="pl-loading">加载中…</p>}
      {projects && projects.length === 0 && (
        <SurfaceCard className="pl-empty">
          <p>还没有项目。先在受访者端创建访谈链接吧。</p>
        </SurfaceCard>
      )}
      {projects && projects.length > 0 && (
        <div className="pl-grid">
          {projects.map((p) => (
            <Link key={p.id} to={`/dashboard/projects/${p.id}`} className="pl-card-link">
              <SurfaceCard className="pl-card">
                <h2 className="pl-card-name">{p.name}</h2>
                <p className="pl-card-time">{formatRelative(p.created_at)}</p>
                <div className="pl-card-stats">
                  <div>
                    <div className="pl-stat-num">{p.total}</div>
                    <div className="pl-stat-label">参与</div>
                  </div>
                  <div>
                    <div className="pl-stat-num">{p.completed}</div>
                    <div className="pl-stat-label">完成</div>
                  </div>
                  <div>
                    <div className="pl-stat-num">
                      {p.avg_duration_min === null ? '—' : `${p.avg_duration_min.toFixed(1)}m`}
                    </div>
                    <div className="pl-stat-label">平均时长</div>
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

export default ProjectsList;
```

- [ ] **Step 3: Typecheck**

```bash
cd client && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/dashboard/ProjectsList.tsx client/src/pages/dashboard/projects-list.css
git commit -m "feat(dashboard): add ProjectsList page"
```

---

## Task 13: `AnalyticsOverview` skeleton + KPI row

**Files:**
- Create: `client/src/pages/dashboard/AnalyticsOverview.tsx`
- Create: `client/src/pages/dashboard/analytics-overview.css`

- [ ] **Step 1: Create the CSS file with KPI styles**

Create `client/src/pages/dashboard/analytics-overview.css`:

```css
.ao-error {
  color: #8a4a4a;
}

.ao-loading {
  color: var(--color-text-secondary);
}

.ao-kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
}

.ao-kpi-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-6);
  min-height: 140px;
}

.ao-kpi-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-semibold);
  display: block;
  margin-bottom: var(--space-1);
}

.ao-kpi-value {
  font-size: 36px;
  font-weight: 300;
  color: var(--color-text-primary);
  margin: 0;
}

.ao-kpi-foot {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.ao-kpi-foot-text {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.ao-growth-pill {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-success-bg);
  color: var(--color-success-text);
}

.ao-growth-pill--neg {
  background: var(--color-glass-tag);
  color: var(--color-text-secondary);
}

.ao-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-circle);
  background: var(--color-status-active);
  box-shadow: var(--shadow-dot);
  animation: ao-pulse 1.6s ease-in-out infinite;
}

.ao-pulse-dot--idle {
  animation: none;
  opacity: 0.4;
}

@keyframes ao-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

- [ ] **Step 2: Create the component**

Create `client/src/pages/dashboard/AnalyticsOverview.tsx`:

```tsx
import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/dashboard-layout/DashboardLayout';
import SurfaceCard from '../../components/surface/SurfaceCard';
import { getDashboardOverview, type DashboardOverview } from '../../api/client';
import './analytics-overview.css';

function AnalyticsOverview() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardOverview()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'));
  }, []);

  if (error) {
    return (
      <DashboardLayout title="Interview Analytics" subtitle="Product Research Insights Overview">
        <p className="ao-error" role="alert">{error}</p>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout title="Interview Analytics" subtitle="Product Research Insights Overview">
        <p className="ao-loading">加载中…</p>
      </DashboardLayout>
    );
  }

  const growth = data.interview_growth_pct;
  const showGrowthPill = growth !== null && growth !== 0;

  return (
    <DashboardLayout title="Interview Analytics" subtitle="Product Research Insights Overview">
      <section className="ao-kpi-row">
        <SurfaceCard className="ao-kpi-card">
          <div>
            <span className="ao-kpi-label">Total Interviews</span>
            <h2 className="ao-kpi-value">{data.total_interviews.toLocaleString()}</h2>
          </div>
          {showGrowthPill && (
            <div className="ao-kpi-foot">
              <span className={`ao-growth-pill${growth! < 0 ? ' ao-growth-pill--neg' : ''}`}>
                {growth! > 0 ? '+' : ''}{growth}% vs last month
              </span>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard className="ao-kpi-card">
          <div>
            <span className="ao-kpi-label">Active Sessions</span>
            <h2 className="ao-kpi-value">{data.in_progress_interviews}</h2>
          </div>
          <div className="ao-kpi-foot">
            <div className={`ao-pulse-dot${data.in_progress_interviews === 0 ? ' ao-pulse-dot--idle' : ''}`} />
            <span className="ao-kpi-foot-text">Live monitoring enabled</span>
          </div>
        </SurfaceCard>

        <SurfaceCard className="ao-kpi-card">
          <div>
            <span className="ao-kpi-label">Total Projects</span>
            <h2 className="ao-kpi-value">{data.total_projects}</h2>
          </div>
          <div className="ao-kpi-foot">
            <span className="ao-kpi-foot-text">Across research workstreams</span>
          </div>
        </SurfaceCard>
      </section>
    </DashboardLayout>
  );
}

export default AnalyticsOverview;
```

- [ ] **Step 3: Typecheck**

```bash
cd client && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/dashboard/AnalyticsOverview.tsx client/src/pages/dashboard/analytics-overview.css
git commit -m "feat(dashboard): add AnalyticsOverview KPI row"
```

---

## Task 14: AnalyticsOverview — mid row (Sparkline + Trending Topics)

**Files:**
- Modify: `client/src/pages/dashboard/AnalyticsOverview.tsx`
- Modify: `client/src/pages/dashboard/analytics-overview.css`

- [ ] **Step 1: Append CSS for the mid row**

Append to `client/src/pages/dashboard/analytics-overview.css`:

```css
.ao-mid-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-6);
  height: 256px;
}

.ao-chart-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: var(--space-6);
  overflow: hidden;
}

.ao-chart-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.ao-card-title {
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.ao-card-subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: var(--space-1) 0 0;
}

.ao-chart-body {
  flex: 1;
  position: relative;
}

.ao-tags-card {
  display: flex;
  flex-direction: column;
  padding: var(--space-6);
}

.ao-tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  flex: 1;
  align-content: flex-start;
}

.ao-tag-pill {
  background: var(--color-glass-tag);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-3);
  font-size: 12px;
  color: var(--color-text-primary);
}

.ao-tag-pill--strong {
  background: var(--color-glass-user);
  font-weight: var(--font-weight-semibold);
}

.ao-tags-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-glass-border);
}

.ao-tags-foot-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.ao-tags-foot-value {
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.ao-tags-empty {
  font-size: 12px;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 2: Add the mid row to the component**

In `client/src/pages/dashboard/AnalyticsOverview.tsx`, add at the top of the imports:

```tsx
import Sparkline from '../../components/charts/Sparkline';
```

Then immediately after the closing `</section>` of `ao-kpi-row` (still inside the `<DashboardLayout>`), insert:

```tsx
      <section className="ao-mid-row">
        <SurfaceCard className="ao-chart-card">
          <div className="ao-chart-card-head">
            <div>
              <h3 className="ao-card-title">Interview Frequency</h3>
              <p className="ao-card-subtitle">Monthly breakdown of conducted sessions</p>
            </div>
          </div>
          <div className="ao-chart-body">
            <Sparkline points={data.monthly_interviews} />
          </div>
        </SurfaceCard>

        <SurfaceCard className="ao-tags-card">
          <h3 className="ao-card-title">Trending Topics</h3>
          <div className="ao-tags-cloud" style={{ marginTop: 'var(--space-4)' }}>
            {data.trending_tags.length === 0 && (
              <p className="ao-tags-empty">No annotations yet — insights will appear as interviews complete.</p>
            )}
            {data.trending_tags.map((tag, idx) => (
              <span
                key={tag.label}
                className={`ao-tag-pill${idx < 2 ? ' ao-tag-pill--strong' : ''}`}
              >
                {tag.label}
              </span>
            ))}
          </div>
          <div className="ao-tags-foot">
            <span className="ao-tags-foot-label">Total Keywords</span>
            <span className="ao-tags-foot-value">{data.total_keyword_count}</span>
          </div>
        </SurfaceCard>
      </section>
```

- [ ] **Step 3: Typecheck**

```bash
cd client && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/dashboard/AnalyticsOverview.tsx client/src/pages/dashboard/analytics-overview.css
git commit -m "feat(dashboard): add frequency chart and trending tags"
```

---

## Task 15: AnalyticsOverview — Recent Interviews table

**Files:**
- Modify: `client/src/pages/dashboard/AnalyticsOverview.tsx`
- Modify: `client/src/pages/dashboard/analytics-overview.css`

- [ ] **Step 1: Append CSS for the table**

Append to `client/src/pages/dashboard/analytics-overview.css`:

```css
.ao-table-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.ao-table-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6);
  border-bottom: 1px solid var(--color-glass-border);
}

.ao-table-head-actions {
  display: flex;
  gap: var(--space-2);
}

.ao-table-icon-btn {
  background: var(--color-glass-tag);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ao-table-icon-btn[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

.ao-filter-select {
  background: var(--color-glass-tag);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: 12px;
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

.ao-table-scroll {
  flex: 1;
  overflow-y: auto;
}

.ao-table {
  width: 100%;
  text-align: left;
  border-collapse: collapse;
}

.ao-table thead tr {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
  color: var(--color-text-secondary);
}

.ao-table th {
  padding: var(--space-4) var(--space-6);
  font-weight: var(--font-weight-semibold);
}

.ao-table tbody tr {
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-standard);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.ao-table tbody tr:hover {
  background: var(--color-glass-hover);
}

.ao-table td {
  padding: var(--space-4) var(--space-6);
  font-size: 14px;
  color: var(--color-text-primary);
}

.ao-cell-mono {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
}

.ao-cell-medium {
  font-weight: var(--font-weight-medium);
}

.ao-project-chip {
  display: inline-block;
  background: var(--color-glass-tag);
  border: 1px solid var(--color-glass-border);
  border-radius: var(--radius-md);
  padding: 2px var(--space-3);
  font-size: 12px;
  color: var(--color-text-primary);
}

.ao-status-badge {
  padding: 4px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  background: var(--color-glass-highlight);
  color: var(--color-text-primary);
}

.ao-status-badge--inprogress {
  background: var(--color-status-warn-bg);
}

.ao-status-badge--abandoned {
  background: rgba(200, 200, 200, 0.4);
  color: var(--color-text-secondary);
}

.ao-table-empty {
  padding: var(--space-8);
  text-align: center;
  color: var(--color-text-secondary);
}

.ao-table-empty a {
  color: var(--color-text-primary);
  text-decoration: underline;
}
```

- [ ] **Step 2: Add the table to the component**

In `client/src/pages/dashboard/AnalyticsOverview.tsx`:

Add to imports (top of file):

```tsx
import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
```

(Combine with the existing `useEffect, useState` import: `import { useEffect, useState, useMemo } from 'react';`)

Add a status filter state after the existing `error` state:

```tsx
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed' | 'abandoned'>('all');
  const navigate = useNavigate();
```

Add a derived `filteredRows`:

```tsx
  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (statusFilter === 'all') return data.recent_interviews;
    return data.recent_interviews.filter(r => r.status === statusFilter);
  }, [data, statusFilter]);
```

Add a date helper alongside the component (above `function AnalyticsOverview`):

```tsx
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatAbsolute(iso: string): string {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function statusBadgeClass(status: 'in_progress' | 'completed' | 'abandoned'): string {
  if (status === 'in_progress') return 'ao-status-badge ao-status-badge--inprogress';
  if (status === 'abandoned') return 'ao-status-badge ao-status-badge--abandoned';
  return 'ao-status-badge';
}

function statusLabel(status: 'in_progress' | 'completed' | 'abandoned'): string {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'abandoned') return 'Abandoned';
  return 'Completed';
}
```

After the closing `</section>` of `ao-mid-row` (still inside `<DashboardLayout>`), insert:

```tsx
      <SurfaceCard className="ao-table-card">
        <div className="ao-table-head">
          <h3 className="ao-card-title">Recent Interviews</h3>
          <div className="ao-table-head-actions">
            <button className="ao-table-icon-btn" disabled aria-label="Search (coming soon)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21 21-4.3-4.3" />
                <circle cx="10" cy="10" r="7" />
              </svg>
            </button>
            <select
              className="ao-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>
        </div>
        <div className="ao-table-scroll">
          {data.recent_interviews.length === 0 && (
            <div className="ao-table-empty">
              No interviews yet. <Link to="/dashboard/projects">Share a project link</Link> to get started.
            </div>
          )}
          {data.recent_interviews.length > 0 && (
            <table className="ao-table">
              <thead>
                <tr>
                  <th>Interview ID</th>
                  <th>Topic / Subject</th>
                  <th>Project</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} onClick={() => navigate(`/dashboard/projects/${row.project_id}`)}>
                    <td className="ao-cell-mono">{row.short_id}</td>
                    <td className="ao-cell-medium">{row.project_name}</td>
                    <td><span className="ao-project-chip">{row.project_name}</span></td>
                    <td>{formatAbsolute(row.started_at)}</td>
                    <td><span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SurfaceCard>
```

- [ ] **Step 3: Typecheck**

```bash
cd client && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/dashboard/AnalyticsOverview.tsx client/src/pages/dashboard/analytics-overview.css
git commit -m "feat(dashboard): add recent interviews table"
```

---

## Task 16: Wire router, delete old DashboardHome, smoke test

**Files:**
- Modify: `client/src/router.tsx`
- Delete: `client/src/pages/dashboard/DashboardHome.tsx`
- Delete: `client/src/pages/dashboard/dashboard-home.css`

- [ ] **Step 1: Update the router**

Overwrite `client/src/router.tsx`:

```tsx
import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/home/HomePage';
import LandingPage from './pages/landing/LandingPage';
import ChatPage from './pages/chat/ChatPage';
import CompletePage from './pages/complete/CompletePage';
import AnalyticsOverview from './pages/dashboard/AnalyticsOverview';
import ProjectsList from './pages/dashboard/ProjectsList';
import ProjectDetail from './pages/dashboard/ProjectDetail';
import CreateProject from './pages/dashboard/CreateProject';

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
    element: <AnalyticsOverview />,
  },
  {
    path: '/dashboard/projects',
    element: <ProjectsList />,
  },
  {
    path: '/dashboard/create',
    element: <CreateProject />,
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

- [ ] **Step 2: Delete the old files**

```bash
rm client/src/pages/dashboard/DashboardHome.tsx
rm client/src/pages/dashboard/dashboard-home.css
```

- [ ] **Step 3: Typecheck**

```bash
cd client && npx tsc --noEmit
```

Expected: exits 0. (If anything imported `DashboardHome`, this catches it.)

- [ ] **Step 4: Run the full server test suite**

```bash
cd server && npm test
```

Expected: all suites pass.

- [ ] **Step 5: Manual smoke test (browser)**

Start the server and client in separate shells, then walk through:

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Verify in the browser:
1. `http://localhost:5173/dashboard` → renders the analytics overview (sidebar visible, KPI row, chart, tags, recent interviews).
2. Empty database state: KPI numbers are 0, chart shows "Waiting for first interviews", tags shows the empty message, table shows "No interviews yet" with a link to `/dashboard/projects`.
3. Click the Projects icon in the sidebar → routes to `/dashboard/projects` with the project list.
4. Click 新建项目 from the project list → routes to `/dashboard/create` (still works).
5. Click any project card → routes to `/dashboard/projects/:id` (still works).
6. From an existing project's detail page, breadcrumb / brand chip behavior should be unchanged.

If any of those fail, do NOT mark this task complete — fix and re-verify.

- [ ] **Step 6: Commit**

```bash
git add client/src/router.tsx
git rm client/src/pages/dashboard/DashboardHome.tsx client/src/pages/dashboard/dashboard-home.css
git commit -m "feat(dashboard): wire analytics overview as new home, move project list to /dashboard/projects"
```

---

## Done

After Task 16, the analytics overview is the new `/dashboard` landing page, the project list is reachable via the sidebar at `/dashboard/projects`, and all existing routes (`/dashboard/create`, `/dashboard/projects/:id`) still work. Backend has 1 new endpoint and ~12 new tests. No new dependencies, no schema migration.
