import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConversationManager } from '../../src/services/conversationManager.js';
import { initDb, getDb } from '../../src/db/database.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-conv.db';

describe('ConversationManager', () => {
  let manager;
  let interviewId;

  beforeEach(() => {
    initDb(TEST_DB);
    const db = getDb();

    const projectId = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      projectId, 'Test', 'Test product', '[]'
    );

    interviewId = uuid();
    db.prepare('INSERT INTO interviews (id, project_id, share_token) VALUES (?, ?, ?)').run(
      interviewId, projectId, 'test-token'
    );

    manager = new ConversationManager(interviewId);
  });

  afterEach(() => {
    getDb().close();
    fs.unlinkSync(TEST_DB);
  });

  it('adds user message and persists to DB', () => {
    manager.addMessage('user', '你好');

    const messages = manager.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('你好');

    const db = getDb();
    const rows = db.prepare('SELECT * FROM messages WHERE interview_id = ?').all(interviewId);
    expect(rows).toHaveLength(1);
  });

  it('adds assistant message with tool calls', () => {
    manager.addMessage('assistant', '你好呀！', [{ name: 'record_insight', arguments: {} }]);

    const messages = manager.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
    expect(messages[0].tool_calls).toEqual([{ name: 'record_insight', arguments: {} }]);
  });

  it('returns messages in chronological order', () => {
    manager.addMessage('user', '第一条');
    manager.addMessage('assistant', '回复一');
    manager.addMessage('user', '第二条');

    const messages = manager.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('第一条');
    expect(messages[2].content).toBe('第二条');
  });

  it('formats messages for LLM API', () => {
    manager.addMessage('user', '你好');
    manager.addMessage('assistant', '嗨！');

    const formatted = manager.getMessagesForLLM();
    expect(formatted).toEqual([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '嗨！' },
    ]);
  });
});
