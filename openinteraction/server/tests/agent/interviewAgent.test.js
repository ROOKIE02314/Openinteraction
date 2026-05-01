import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InterviewAgent } from '../../src/agent/interviewAgent.js';
import { initDb, getDb } from '../../src/db/database.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

const TEST_DB = './test-agent.db';

describe('InterviewAgent', () => {
  let agent;
  let interviewId;
  let mockLLM;

  beforeEach(() => {
    initDb(TEST_DB);
    const db = getDb();

    const projectId = uuid();
    db.prepare('INSERT INTO projects (id, name, product_context, core_topics) VALUES (?, ?, ?, ?)').run(
      projectId, 'TestApp', '一个测试产品', JSON.stringify([
        { id: 'search', description: '搜索体验' },
      ])
    );

    interviewId = uuid();
    db.prepare('INSERT INTO interviews (id, project_id, share_token) VALUES (?, ?, ?)').run(
      interviewId, projectId, 'test-token'
    );

    mockLLM = {
      chat: vi.fn(),
    };

    agent = new InterviewAgent(interviewId, projectId, mockLLM);
  });

  afterEach(() => {
    getDb().close();
    fs.unlinkSync(TEST_DB);
  });

  it('processes user message and returns agent response', async () => {
    mockLLM.chat.mockResolvedValue({
      content: '你好呀！最近用我们产品感觉怎么样？',
      toolCalls: [],
    });

    const result = await agent.processMessage('你好');

    expect(result.response).toBe('你好呀！最近用我们产品感觉怎么样？');
    expect(result.toolCalls).toEqual([]);
    expect(result.interviewStatus).toBe('in_progress');
  });

  it('executes tool calls and sends results back to LLM', async () => {
    // First call: agent wants to call a tool
    mockLLM.chat.mockResolvedValueOnce({
      content: '搜索确实挺重要的',
      toolCalls: [
        {
          id: 'call_1',
          name: 'extract_annotation',
          arguments: { category: 'pain_point', label: '搜索不好用', severity: 'high' },
        },
      ],
    });

    // Second call: after tool result, agent responds to user
    mockLLM.chat.mockResolvedValueOnce({
      content: '能具体说说搜索哪里不好用吗？',
      toolCalls: [],
    });

    const result = await agent.processMessage('搜索功能不太好用');

    expect(result.response).toBe('能具体说说搜索哪里不好用吗？');
    expect(mockLLM.chat).toHaveBeenCalledTimes(2);
  });

  it('handles end_interview tool call', async () => {
    // Default fallback for subsequent LLM calls after tool execution
    mockLLM.chat.mockResolvedValue({
      content: '感谢你的反馈！',
      toolCalls: [
        {
          id: 'call_1',
          name: 'end_interview',
          arguments: { reason: '话题已覆盖', summary: '讨论了搜索体验' },
        },
      ],
    });

    // First LLM call triggers end_interview
    mockLLM.chat.mockResolvedValueOnce({
      content: '感谢你的反馈！',
      toolCalls: [
        {
          id: 'call_1',
          name: 'end_interview',
          arguments: { reason: '话题已覆盖', summary: '讨论了搜索体验' },
        },
      ],
    });

    const result = await agent.processMessage('就这些吧');

    expect(result.interviewStatus).toBe('completed');
  });

  it('returns error message when LLM fails', async () => {
    mockLLM.chat.mockRejectedValue(new Error('API error'));

    const result = await agent.processMessage('你好');

    expect(result.response).toContain('抱歉');
    expect(result.error).toBeDefined();
  });
});
