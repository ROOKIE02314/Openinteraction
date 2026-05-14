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
