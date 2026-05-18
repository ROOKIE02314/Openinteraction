import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, getDb } from '../../src/db/database.js';
import { getProjectsOverview, getProjectMetrics, getDashboardOverview } from '../../src/services/metricsService.js';
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
    expect(getProjectMetrics(getDb(), 'nonexistent')).toBeNull();
  });

  it('returns full metrics shape for a project with data', async () => {
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

describe('getDashboardOverview — growth_pct', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  function thisMonth(day) {
    const d = new Date();
    d.setDate(1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} 10:00:00`;
  }

  function lastMonth(day) {
    const d = new Date();
    d.setDate(1);
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
