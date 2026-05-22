import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { initDb, getDb } from '../../src/db/database.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-routes-chat.db';

// Mock InterviewAgent to avoid real LLM calls in stream tests
let mockProcessMessageStream;
vi.mock('../../src/agent/interviewAgent.js', () => ({
  InterviewAgent: vi.fn().mockImplementation(function () {
    this.processMessageStream = (...args) => mockProcessMessageStream(...args);
  }),
}));

// Mock TTS service to avoid real TTS calls
vi.mock('../../src/services/ttsService.js', () => ({
  synthesizeToBase64: vi.fn().mockResolvedValue('dGVzdC1hdWRpby1iYXNlNjQ='),
}));

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
    // Close any existing connection, remove leftover DB files, then reinit
    try { getDb().close(); } catch {}
    try { fs.unlinkSync(TEST_DB); } catch {}
    try { fs.unlinkSync(TEST_DB + '-wal'); } catch {}
    try { fs.unlinkSync(TEST_DB + '-shm'); } catch {}

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
    try { fs.unlinkSync(TEST_DB + '-wal'); } catch {}
    try { fs.unlinkSync(TEST_DB + '-shm'); } catch {}
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

describe('Chat Stream Routes', () => {
  let interviewId;
  let projectId;
  const streamTestDb = './test-routes-chat-stream.db';

  beforeEach(() => {
    process.env.DB_PATH = streamTestDb;
    // Close any existing connection, remove leftover DB files, then reinit
    try { getDb().close(); } catch {}
    try { fs.unlinkSync(streamTestDb); } catch {}
    try { fs.unlinkSync(streamTestDb + '-wal'); } catch {}
    try { fs.unlinkSync(streamTestDb + '-shm'); } catch {}

    initDb(streamTestDb);
    const db = getDb();

    projectId = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      projectId, 'TestApp', 'A test app', JSON.stringify([{ id: 'search', description: '搜索体验' }])
    );

    interviewId = uuid();
    db.prepare('INSERT INTO interviews (id, project_id, share_token) VALUES (?, ?, ?)').run(
      interviewId, projectId, 'stream-test-token'
    );

    mockProcessMessageStream = async function* () {
      yield { type: 'emotion', state: 'listening' };
      yield { type: 'text', content: '你好！' };
      yield { type: 'emotion', state: 'speaking' };
      yield { type: 'text', content: '很高兴认识你。' };
      yield { type: 'emotion', state: 'idle' };
      yield { type: 'done', interviewStatus: 'in_progress' };
    };
  });

  afterEach(() => {
    getDb().close();
    try { fs.unlinkSync(streamTestDb); } catch {}
    try { fs.unlinkSync(streamTestDb + '-wal'); } catch {}
    try { fs.unlinkSync(streamTestDb + '-shm'); } catch {}
  });

  it('POST /api/chat/stream requires interview_id and message', async () => {
    await request(app)
      .post('/api/chat/stream')
      .send({})
      .expect(400);
  });

  it('POST /api/chat/stream returns 404 for invalid interview', async () => {
    await request(app)
      .post('/api/chat/stream')
      .send({ interview_id: 'nonexistent', message: 'hello' })
      .expect(404);
  });

  it('POST /api/chat/stream returns 400 for completed interview', async () => {
    const db = getDb();
    db.prepare('UPDATE interviews SET status = ? WHERE id = ?').run('completed', interviewId);

    await request(app)
      .post('/api/chat/stream')
      .send({ interview_id: interviewId, message: 'hello' })
      .expect(400);
  });

  it('POST /api/chat/stream returns SSE headers', async () => {
    const res = await request(app)
      .post('/api/chat/stream')
      .send({ interview_id: interviewId, message: 'hello' });

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['connection']).toBe('keep-alive');
    expect(res.headers['x-accel-buffering']).toBe('no');
  });

  it('POST /api/chat/stream sends text, audio, and done SSE events', async () => {
    const res = await request(app)
      .post('/api/chat/stream')
      .send({ interview_id: interviewId, message: '你好' });

    const body = res.text;

    // Should contain text events
    expect(body).toContain('event: text');
    expect(body).toContain('"chunk"');

    // Should contain audio events
    expect(body).toContain('event: audio');

    // Should contain a done event at the end
    expect(body).toContain('event: done');
    expect(body).toContain('"interview_status"');
  });

  it('POST /api/chat/stream sends emotion SSE events', async () => {
    const res = await request(app)
      .post('/api/chat/stream')
      .send({ interview_id: interviewId, message: '你好' });

    const body = res.text;

    expect(body).toContain('event: emotion');
    expect(body).toContain('"state":"listening"');
    expect(body).toContain('"state":"speaking"');
    expect(body).toContain('"state":"idle"');
  });
});
