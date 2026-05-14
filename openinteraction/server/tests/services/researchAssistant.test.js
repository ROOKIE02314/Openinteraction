import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDb, getDb } from '../../src/db/database.js';
import { buildContext, estimateTokens, buildContextWithBudget } from '../../src/services/researchAssistant.js';
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
