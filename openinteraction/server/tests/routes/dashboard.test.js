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
