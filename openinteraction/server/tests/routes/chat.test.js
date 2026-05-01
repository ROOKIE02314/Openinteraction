import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import { initDb, getDb } from '../../src/db/database.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-routes-chat.db';

let app;

beforeAll(async () => {
  process.env.DB_PATH = TEST_DB;
  process.env.LLM_API_KEY = 'test-key';
  process.env.LLM_BASE_URL = 'http://localhost:9999';
  const mod = await import('../../src/index.js');
  app = mod.default;
});

describe('Chat Routes', () => {
  let interviewId;

  beforeEach(() => {
    initDb(TEST_DB);
    const db = getDb();

    const projectId = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      projectId, 'TestApp', 'A test app', JSON.stringify([{ id: 'search', description: '搜索体验' }])
    );

    interviewId = uuid();
    db.prepare('INSERT INTO interviews (id, project_id, share_token) VALUES (?, ?, ?)').run(
      interviewId, projectId, 'test-token'
    );
  });

  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(TEST_DB); } catch {}
  });

  it('POST /api/chat requires interview_id and message', async () => {
    await request(app)
      .post('/api/chat')
      .send({})
      .expect(400);
  });

  it('POST /api/chat returns 404 for invalid interview', async () => {
    await request(app)
      .post('/api/chat')
      .send({ interview_id: 'nonexistent', message: 'hello' })
      .expect(404);
  });
});
