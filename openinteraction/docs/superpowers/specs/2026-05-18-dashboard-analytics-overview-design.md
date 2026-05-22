# Dashboard Analytics Overview — Design Spec

**Date**: 2026-05-18
**Branch**: `feat/dashboard-create-project` (or successor)
**Reference template**: `variant.com/design-fetched.html` (Variant share `9af38731-…`, "Interview Analytics Dashboard")

## 1. Goal

Replace the current `DashboardHome` (a flat grid of project cards) with a cross-project **analytics overview** modeled after the Variant template. Adopt the template's left-icon-rail + KPI-row + chart + tag-cloud + recent-interviews-table layout, but only display elements that can be driven by real data already in the schema. The existing project list moves to a new `/dashboard/projects` route, reachable from the sidebar.

## 2. Non-goals

- No authentication / user accounts (the template's user-pill is dropped, not stubbed).
- No participant identities (interviews are anonymous; the template's avatar stack column is replaced by a project-name chip).
- No new data tables or migrations.
- No chart library dependency.
- No frontend test infrastructure (codebase has none today; not introduced here).
- Search input on the Recent Interviews table is rendered but disabled (TODO for a follow-up).

## 3. Scope decisions (already locked with user)

| Decision | Choice |
|---|---|
| Scope | DashboardHome **replaced** by analytics overview; project list moves to `/dashboard/projects` |
| KPIs | **Total Interviews**, **Active Sessions**, **Total Projects** |
| Sidebar items | **Overview**, **Projects**, **Settings** (Settings as disabled cog placeholder) |
| Implementation path | **B — adapted to reality** (drop avatar stack and user pill; keep chart and trending tags) |

## 4. Architecture

### 4.1 Layout chrome

`DashboardLayout` is restructured from "top-only header" to "left sidebar + right column":

```
┌──────┬─────────────────────────────────────────┐
│      │  page header (title + subtitle / brand) │
│ 🏠   │                                         │
│ 📁   ├─────────────────────────────────────────┤
│      │  main content (children)                │
│ ⚙️   │                                         │
└──────┴─────────────────────────────────────────┘
```

- **`Sidebar.tsx`** (new) — 80px wide, glass-panel; renders three icon buttons:
  - `Overview` → `/dashboard` (grid icon, active when path is exactly `/dashboard`)
  - `Projects` → `/dashboard/projects` (folder/list icon, active when path starts with `/dashboard/projects`)
  - `Settings` → bottom of rail, **disabled** (cog icon, `aria-disabled`, no click handler)
  - Active state: `background: var(--color-glass-hover)` and stronger icon stroke
- **`DashboardLayout.tsx`** keeps `breadcrumb` prop (still used by `ProjectDetail`); brand chip ("研究面板" + dot) moves into the right-side header next to the breadcrumb. The user-pill from the template is **not** ported.

### 4.2 Pages

- **`AnalyticsOverview.tsx`** (new, mounts at `/dashboard`) — composed of three sections stacked with `gap-6`:
  1. KPI row (3 glass-panels, `grid-cols-3`)
  2. Mid row (`grid-cols-3 h-64`): `Sparkline` (col-span 2) + Trending Topics (col-span 1)
  3. Recent Interviews table (`flex-1`, scrollable)
- **`ProjectsList.tsx`** (new, mounts at `/dashboard/projects`) — exact code lifted from current `DashboardHome.tsx`: header row "研究项目" + 新建项目 button + grid of project cards.
- **`DashboardHome.tsx` and `dashboard-home.css` are deleted.** All visible behaviour migrates to the two new files above.

### 4.3 Routing

Edit `client/src/router.tsx`:

```
/dashboard                 → AnalyticsOverview          (was DashboardHome)
/dashboard/projects        → ProjectsList               (new)
/dashboard/create          → CreateProject              (unchanged)
/dashboard/projects/:id    → ProjectDetail              (unchanged)
```

The `DashboardHome` import is removed and replaced by `AnalyticsOverview` and `ProjectsList`.

## 5. Data model & backend

### 5.1 No schema changes

All data sourced from existing tables: `projects`, `interviews`, `annotations`.

### 5.2 New service function

`server/src/services/metricsService.js` gains:

```js
export function getDashboardOverview(db) {
  return {
    total_interviews: number,
    in_progress_interviews: number,
    total_projects: number,
    interview_growth_pct: number | null,   // null when previous month had 0
    monthly_interviews: Array<{ month: string, count: number }>,  // last 7 buckets incl. current month
    trending_tags: Array<{ label: string, count: number }>,        // top 9 by count, descending
    total_keyword_count: number,                                   // distinct annotation labels
    recent_interviews: Array<{
      id: string,
      short_id: string,             // `INT-${id.slice(0, 4)}`
      project_id: string,
      project_name: string,
      status: 'in_progress' | 'completed' | 'abandoned',
      started_at: string,
    }>,
  };
}
```

Implementation notes:
- All five queries are synchronous via `better-sqlite3`.
- `interview_growth_pct` = `(this_month - last_month) / last_month * 100`, rounded to 0 decimals; `null` when `last_month === 0` (UI hides the pill).
- `monthly_interviews` uses `strftime('%Y-%m', started_at)` grouping with `WHERE started_at >= date('now', '-6 months')`. Buckets with zero interviews must still appear (zero-fill in JS after the query so the chart x-axis is continuous).
- `trending_tags` = `SELECT label, COUNT(*) c FROM annotations GROUP BY label ORDER BY c DESC LIMIT 9`.
- `total_keyword_count` = `SELECT COUNT(DISTINCT label) FROM annotations`.
- `recent_interviews` = `LIMIT 20`, joined to `projects` for `project_name`, `ORDER BY started_at DESC`.

### 5.3 New route

`server/src/routes/dashboard.js`:

```js
router.get('/overview', (req, res) => {
  res.json(getDashboardOverview(getDb()));
});
```

Single round trip; one render.

## 6. Component-level detail

### 6.1 KPI cards

Each KPI is a `glass-panel p-6 flex flex-col justify-between`. Numbers use `text-4xl font-light`, labels use `text-[10px] uppercase tracking-widest`. Subline:

| Card | Subline |
|---|---|
| Total Interviews | green pill `+N% vs last month` (hidden when `interview_growth_pct` is `null` or `0`) |
| Active Sessions | pulsing dot + `Live monitoring enabled` (animation enabled only when count > 0) |
| Total Projects | static text `Across research workstreams` |

### 6.2 `Sparkline.tsx`

Reusable inline-SVG line chart. Props: `points: Array<{ label: string, value: number }>` and optional `height`. Renders a 800×120 viewBox path: smooth cubic Bezier through normalized values, semi-transparent area fill below, x-axis labels from `points[i].label`. Animates on mount via `stroke-dasharray`/`dashoffset`. No external chart dependency.

Empty state (all `value === 0`): a single horizontal dashed line at mid-height + caption "Waiting for first interviews". No animation.

### 6.3 Trending Topics card

`glass-panel p-6` with title "Trending Topics", a wrap of glass-card pills (one per `trending_tags[i]`). Top-2 tags get the emphasis style (`bg-white/40 font-semibold`). Bottom row: divider + "Total Keywords: N" using `total_keyword_count`.

Empty state: "No annotations yet — insights will appear as interviews complete."

### 6.4 Recent Interviews table

Header: title + a search icon button (rendered, **`disabled`**) and a Filter dropdown (functional). Filter options: All / In Progress / Completed / Abandoned (default All). Filtering is **client-side** over the 20 rows from the API.

Columns:

| # | Column | Source | Notes |
|---|---|---|---|
| 1 | Interview ID | `short_id` | `font-mono text-xs` |
| 2 | Topic / Subject | `project_name` | medium weight |
| 3 | Project | `project_name` rendered as a `glass-card` chip | Replaces template's avatar stack |
| 4 | Date | `formatAbsolute(started_at)` → `MMM DD, YYYY` | New helper to add alongside `formatRelative` |
| 5 | Status | status badge | `completed`: `bg-white/40` text-default; `in_progress`: `bg-white/60` + pulse; `abandoned`: `bg-gray-200/60 text-gray-500` |
| 6 | Action | 3-dot icon button | Click handler: navigate to `/dashboard/projects/${project_id}`. Whole row is also clickable to the same target. |

Note: columns 2 and 3 both display `project_name` today (no separate "topic" data exists). This is intentional — the column header "Topic / Subject" matches the template; the chip in column 3 acts as a project anchor. If a separate "interview topic" field is added in the future, column 2 swaps to that field with no other changes.

Empty state: a centered placeholder row "No interviews yet. Share a project link to get started." with a link to `/dashboard/projects`.

## 7. Visual tokens

Reuse existing tokens (`--color-glass-*`, `--color-text-*`, `--space-*`, `--radius-*`, `--font-weight-*`, `--letter-spacing-*`).

Add to `client/src/styles/tokens.css` (verified absent today):

```
--color-success-bg:    rgba(150, 200, 150, 0.25);
--color-success-text:  #3b6b3b;
--color-status-active: rgba(255, 255, 255, 0.85);   /* pulse dot color */
--color-status-warn-bg: rgba(255, 255, 255, 0.6);   /* in_progress badge */
```

## 8. File-level change list

### Added
- `client/src/pages/dashboard/AnalyticsOverview.tsx`
- `client/src/pages/dashboard/analytics-overview.css`
- `client/src/pages/dashboard/ProjectsList.tsx`
- `client/src/pages/dashboard/projects-list.css`
- `client/src/components/dashboard-layout/Sidebar.tsx`
- `client/src/components/dashboard-layout/sidebar.css`
- `client/src/components/charts/Sparkline.tsx`
- `client/src/components/charts/sparkline.css`

### Modified
- `client/src/components/dashboard-layout/DashboardLayout.tsx` — sidebar + main grid
- `client/src/components/dashboard-layout/dashboard-layout.css` — rewrite for sidebar + main
- `client/src/api/client.ts` — add `getDashboardOverview()` and a typed `DashboardOverview` interface
- `client/src/router.tsx` — replace `DashboardHome` import with `AnalyticsOverview`; add `/dashboard/projects` → `ProjectsList`
- `server/src/services/metricsService.js` — add `getDashboardOverview()`
- `server/src/routes/dashboard.js` — add `GET /api/dashboard/overview`

### Removed
- `client/src/pages/dashboard/DashboardHome.tsx`
- `client/src/pages/dashboard/dashboard-home.css`

## 9. Tests

- `server/tests/services/metricsService.test.js` (extend) — cases:
  1. Empty database → all counts 0, `interview_growth_pct === null`, arrays empty.
  2. Single project, no interviews → `total_projects: 1`, others 0.
  3. Multiple projects, mixed statuses → counts correct; `recent_interviews` is sorted desc and capped at 20.
  4. Growth: `last_month=10, this_month=12` → `interview_growth_pct === 20`.
  5. Growth edge: `last_month=0, this_month=5` → `interview_growth_pct === null`.
  6. `monthly_interviews` covers exactly 7 buckets even when some are empty.
  7. `trending_tags` returns at most 9, ordered by count desc; ties resolved by label ASC for determinism.
- `server/tests/routes/dashboard.test.js` (extend) — `GET /api/dashboard/overview` returns 200 and the documented shape.

No frontend tests added (no harness exists in the codebase today).

## 10. Risks & open questions

- **Tie-breaking on `trending_tags`** is specified (count desc, label asc) — guards against snapshot test flakiness.
- **`monthly_interviews` bucket count** — fixed at 7 (last 6 months + current). Alternative would be 12; not chosen because a 12-month line would require the chart card to be wider than 2/3.
- **Avatar column replacement** uses a project-name chip. If a future feature adds a "participant alias" or "respondent count", column 3 swaps cleanly without breaking the rest.
- **Settings sidebar item** is a placeholder. If it should be removed entirely, that's a one-line change in `Sidebar.tsx` — flag during implementation review if preferences shift.

## 11. Out of scope (explicit)

- Search inside Recent Interviews (input rendered but disabled).
- Cross-project Insights / Annotations browser page.
- Cross-project Interviews list page beyond the 20-row table on the overview.
- Authentication, user pill in header.
- Real-time WebSocket updates for `Active Sessions` (page polls on mount only; refresh by reload).
- Accessibility audit beyond minimum (semantic landmarks, alt text on icons).
