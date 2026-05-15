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

describe('Dashboard routes — POST /api/dashboard/projects', () => {
  beforeEach(() => initDb(TEST_DB));
  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('creates a project and returns 201', async () => {
    const res = await request(app)
      .post('/api/dashboard/projects')
      .send({
        name: '淘宝',
        product_context: '中国最大的综合电商平台',
        core_topics: [
          { id: 'browse', description: '浏览商品体验' },
          { id: 'checkout', description: '下单支付体验' },
        ],
      })
      .expect(201);

    expect(res.body).toMatchObject({
      name: '淘宝',
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.created_at).toBeDefined();

    // Verify in DB
    const db = getDb();
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(res.body.id);
    expect(row.name).toBe('淘宝');
    expect(row.product_context).toBe('中国最大的综合电商平台');
    expect(JSON.parse(row.core_topics)).toEqual([
      { id: 'browse', description: '浏览商品体验' },
      { id: 'checkout', description: '下单支付体验' },
    ]);
  });

  it('returns 400 when name is missing', async () => {
    await request(app)
      .post('/api/dashboard/projects')
      .send({ core_topics: [{ id: 'x', description: 'y' }] })
      .expect(400);
  });

  it('returns 400 when core_topics is empty', async () => {
    await request(app)
      .post('/api/dashboard/projects')
      .send({ name: '淘宝', core_topics: [] })
      .expect(400);
  });

  it('returns 400 when core_topics is missing', async () => {
    await request(app)
      .post('/api/dashboard/projects')
      .send({ name: '淘宝' })
      .expect(400);
  });
});

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
