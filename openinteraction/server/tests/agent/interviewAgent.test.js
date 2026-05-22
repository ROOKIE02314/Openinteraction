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

// Helper to collect all yields from an async generator
async function collectStream(gen) {
  const results = [];
  for await (const chunk of gen) {
    results.push(chunk);
  }
  return results;
}

describe('InterviewAgent.processMessageStream', () => {
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
      chatStream: vi.fn(),
    };

    agent = new InterviewAgent(interviewId, projectId, mockLLM);
  });

  afterEach(() => {
    getDb().close();
    fs.unlinkSync(TEST_DB);
  });

  it('streams text chunks and yields done', async () => {
    async function* mockStream() {
      yield { type: 'text', content: '你好' };
      yield { type: 'text', content: '呀！' };
      yield { type: 'done' };
    }
    mockLLM.chatStream.mockReturnValue(mockStream());

    const results = await collectStream(agent.processMessageStream('你好'));

    const textChunks = results.filter(r => r.type === 'text');
    expect(textChunks.map(r => r.content)).toEqual(['你好', '呀！']);

    const doneChunk = results.find(r => r.type === 'done');
    expect(doneChunk).toBeDefined();
    expect(doneChunk.interviewStatus).toBe('in_progress');
  });

  it('handles tool calls: executes them and loops for post-tool response', async () => {
    // First stream: text + tool_call
    async function* firstStream() {
      yield { type: 'text', content: '搜索确实挺重要的' };
      yield {
        type: 'tool_call',
        toolCalls: [
          {
            id: 'call_1',
            name: 'extract_annotation',
            arguments: { category: 'pain_point', label: '搜索不好用', severity: 'high' },
          },
        ],
      };
      yield { type: 'done', reason: 'tool_calls' };
    }

    // Second stream: post-tool text response
    async function* secondStream() {
      yield { type: 'text', content: '能具体说说搜索哪里不好用吗？' };
      yield { type: 'done' };
    }

    mockLLM.chatStream
      .mockReturnValueOnce(firstStream())
      .mockReturnValueOnce(secondStream());

    const results = await collectStream(agent.processMessageStream('搜索功能不太好用'));

    expect(mockLLM.chatStream).toHaveBeenCalledTimes(2);

    const textChunks = results.filter(r => r.type === 'text');
    expect(textChunks.map(r => r.content)).toEqual([
      '搜索确实挺重要的',
      '能具体说说搜索哪里不好用吗？',
    ]);

    const doneChunk = results.find(r => r.type === 'done');
    expect(doneChunk.interviewStatus).toBe('in_progress');
  });

  it('handles end_interview tool call and yields completed status', async () => {
    async function* mockStream() {
      yield { type: 'text', content: '感谢你的反馈！' };
      yield {
        type: 'tool_call',
        toolCalls: [
          {
            id: 'call_1',
            name: 'end_interview',
            arguments: { reason: '话题已覆盖', summary: '讨论了搜索体验' },
          },
        ],
      };
      yield { type: 'done', reason: 'tool_calls' };
    }

    // Second stream after end_interview tool result
    async function* secondStream() {
      yield { type: 'text', content: '感谢参与！' };
      yield { type: 'done' };
    }

    mockLLM.chatStream
      .mockReturnValueOnce(mockStream())
      .mockReturnValueOnce(secondStream());

    const results = await collectStream(agent.processMessageStream('就这些吧'));

    const doneChunk = results.find(r => r.type === 'done');
    expect(doneChunk.interviewStatus).toBe('completed');
  });

  it('yields error chunk when stream throws', async () => {
    async function* mockStream() {
      throw new Error('Stream API error');
    }
    mockLLM.chatStream.mockReturnValue(mockStream());

    const results = await collectStream(agent.processMessageStream('你好'));

    const errorChunk = results.find(r => r.type === 'error');
    expect(errorChunk).toBeDefined();
    expect(errorChunk.message).toBe('Stream API error');

    const doneChunk = results.find(r => r.type === 'done');
    expect(doneChunk).toBeDefined();
    expect(doneChunk.interviewStatus).toBe('in_progress');
  });

  it('saves the final assistant message to the database', async () => {
    async function* mockStream() {
      yield { type: 'text', content: '你好呀！' };
      yield { type: 'done' };
    }
    mockLLM.chatStream.mockReturnValue(mockStream());

    await collectStream(agent.processMessageStream('你好'));

    const db = getDb();
    const messages = db.prepare(
      "SELECT * FROM messages WHERE interview_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1"
    ).all(interviewId);

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('你好呀！');
  });
});
