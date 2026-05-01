import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import { initDb, getDb } from '../../src/db/database.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-routes-interview.db';

let app;

beforeAll(async () => {
  process.env.DB_PATH = TEST_DB;
  const mod = await import('../../src/index.js');
  app = mod.default;
});

describe('Interview Routes', () => {
  let projectId;

  beforeEach(() => {
    initDb(TEST_DB);
    const db = getDb();

    projectId = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      projectId, 'TestApp', 'A test app', JSON.stringify([{ id: 'search', description: '搜索体验' }])
    );
  });

  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('POST /api/interview/create creates interview and returns share link', async () => {
    const res = await request(app)
      .post('/api/interview/create')
      .send({ project_id: projectId })
      .expect(201);

    expect(res.body.interview_id).toBeDefined();
    expect(res.body.share_token).toBeDefined();
    expect(res.body.share_link).toContain(res.body.share_token);
  });

  it('GET /api/interview/:token returns interview data', async () => {
    const createRes = await request(app)
      .post('/api/interview/create')
      .send({ project_id: projectId });

    const token = createRes.body.share_token;

    const res = await request(app)
      .get(`/api/interview/${token}`)
      .expect(200);

    expect(res.body.status).toBe('in_progress');
    expect(res.body.project_name).toBe('TestApp');
  });

  it('GET /api/interview/:token returns 404 for invalid token', async () => {
    await request(app)
      .get('/api/interview/nonexistent')
      .expect(404);
  });
});
