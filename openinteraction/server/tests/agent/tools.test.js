import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toolDefinitions, executeTool } from '../../src/agent/tools.js';
import { initDb, getDb } from '../../src/db/database.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-tools.db';

describe('agent tools', () => {
  let interviewId;

  beforeEach(() => {
    initDb(TEST_DB);
    const db = getDb();

    const projectId = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      projectId, 'Test Product', 'A test product', '[]'
    );

    interviewId = uuid();
    db.prepare('INSERT INTO interviews (id, project_id, share_token) VALUES (?, ?, ?)').run(
      interviewId, projectId, 'test-token'
    );

    const msgId = uuid();
    db.prepare('INSERT INTO messages (id, interview_id, role, content) VALUES (?, ?, ?, ?)').run(
      msgId, interviewId, 'user', '搜索功能不太好用'
    );
  });

  afterEach(() => {
    getDb().close();
    fs.unlinkSync(TEST_DB);
  });

  it('exports 4 tool definitions', () => {
    expect(toolDefinitions).toHaveLength(4);
    const names = toolDefinitions.map(t => t.function.name);
    expect(names).toContain('record_insight');
    expect(names).toContain('mark_topic_covered');
    expect(names).toContain('extract_annotation');
    expect(names).toContain('end_interview');
  });

  it('record_insight saves insight to annotations table', () => {
    const result = executeTool('record_insight', {
      topic: 'search',
      insight: '搜索结果不准确',
      emotion: 'frustrated',
      quote: '搜出来的都不是我想要的',
    }, interviewId);

    expect(result.success).toBe(true);

    const db = getDb();
    const annotations = db.prepare('SELECT * FROM annotations WHERE interview_id = ? AND category = ?').all(interviewId, 'insight');
    expect(annotations).toHaveLength(1);
    expect(annotations[0].label).toBe('search');
    expect(annotations[0].context).toBe('[emotion: frustrated] 搜索结果不准确');
  });

  it('extract_annotation saves to annotations table', () => {
    const result = executeTool('extract_annotation', {
      category: 'pain_point',
      label: '搜索不精准',
      severity: 'high',
      quote: '搜出来的都不是我想要的',
      context: '用户多次提到搜索结果不准确',
    }, interviewId);

    expect(result.success).toBe(true);

    const db = getDb();
    const annotations = db.prepare('SELECT * FROM annotations WHERE interview_id = ?').all(interviewId);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].category).toBe('pain_point');
    expect(annotations[0].label).toBe('搜索不精准');
    expect(annotations[0].severity).toBe('high');
  });

  it('mark_topic_covered returns success', () => {
    const result = executeTool('mark_topic_covered', {
      topic_id: 'search_experience',
      coverage: 'full',
      notes: '用户充分讨论了搜索体验',
    }, interviewId);

    expect(result.success).toBe(true);

    const db = getDb();
    const annotations = db.prepare('SELECT * FROM annotations WHERE interview_id = ? AND category = ?').all(interviewId, 'topic_coverage');
    expect(annotations).toHaveLength(1);
    expect(annotations[0].label).toBe('search_experience:full');
    expect(annotations[0].context).toBe('用户充分讨论了搜索体验');
  });

  it('end_interview updates interview status', () => {
    const result = executeTool('end_interview', {
      reason: '核心话题已覆盖',
      summary: '用户反馈了搜索和加载问题',
    }, interviewId);

    expect(result.success).toBe(true);

    const db = getDb();
    const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);
    expect(interview.status).toBe('completed');
    expect(interview.ended_at).not.toBeNull();
  });

  it('throws on unknown tool name', () => {
    expect(() => executeTool('unknown_tool', {}, interviewId)).toThrow('Unknown tool');
  });
});
