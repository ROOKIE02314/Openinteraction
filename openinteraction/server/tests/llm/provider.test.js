import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMProvider } from '../../src/llm/provider.js';

describe('LLMProvider', () => {
  let provider;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };
    provider = new LLMProvider({ client: mockClient });
  });

  it('sends messages to LLM with system prompt', async () => {
    mockClient.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Hello!', tool_calls: null } }],
    });

    const result = await provider.chat({
      system: 'You are a friend.',
      messages: [{ role: 'user', content: 'Hi' }],
      tools: [],
    });

    expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'You are a friend.' },
          { role: 'user', content: 'Hi' },
        ],
      })
    );
    expect(result.content).toBe('Hello!');
    expect(result.toolCalls).toEqual([]);
  });

  it('returns tool calls when LLM uses tools', async () => {
    const toolCalls = [
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'record_insight', arguments: '{"topic":"search","insight":"slow"}' },
      },
    ];
    mockClient.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'I see.', tool_calls: toolCalls } }],
    });

    const result = await provider.chat({
      system: 'You are a friend.',
      messages: [{ role: 'user', content: '搜索很慢' }],
      tools: [{ type: 'function', function: { name: 'record_insight' } }],
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('record_insight');
    expect(result.toolCalls[0].arguments.topic).toBe('search');
  });

  it('handles LLM API errors gracefully', async () => {
    mockClient.chat.completions.create.mockRejectedValue(new Error('API timeout'));

    await expect(
      provider.chat({
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [],
      })
    ).rejects.toThrow('API timeout');
  });

  describe('chatStream', () => {
    function makeStream(chunks) {
      return {
        [Symbol.asyncIterator]() {
          let i = 0;
          return {
            async next() {
              if (i < chunks.length) return { value: chunks[i++], done: false };
              return { value: undefined, done: true };
            },
          };
        },
      };
    }

    it('streams text deltas', async () => {
      const chunks = [
        { choices: [{ delta: { content: 'Hello' }, finish_reason: null }] },
        { choices: [{ delta: { content: ' world' }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: 'stop' }] },
      ];
      mockClient.chat.completions.create.mockResolvedValue(makeStream(chunks));

      const events = [];
      for await (const event of provider.chatStream({
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'text', content: 'Hello' },
        { type: 'text', content: ' world' },
        { type: 'done' },
      ]);
    });

    it('streams tool call deltas and yields tool_calls event', async () => {
      const chunks = [
        { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'record_insight', arguments: '' } }] }, finish_reason: null }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"topic":"' } }] }, finish_reason: null }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'search"}' } }] }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      ];
      mockClient.chat.completions.create.mockResolvedValue(makeStream(chunks));

      const events = [];
      for await (const event of provider.chatStream({
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [{ type: 'function', function: { name: 'record_insight' } }],
      })) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: 'tool_call', toolCalls: [{ id: 'call_1', name: 'record_insight', arguments: { topic: 'search' } }] },
        { type: 'done', reason: 'tool_calls' },
      ]);
    });

    it('passes stream: true and correct messages to the API', async () => {
      mockClient.chat.completions.create.mockResolvedValue(makeStream([
        { choices: [{ delta: {}, finish_reason: 'stop' }] },
      ]));

      // consume the generator
      for await (const _ of provider.chatStream({
        system: 'sys',
        messages: [{ role: 'user', content: 'q' }],
        tools: [],
      })) {
        // noop
      }

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          messages: [
            { role: 'system', content: 'sys' },
            { role: 'user', content: 'q' },
          ],
        })
      );
    });

    it('includes tools in the request when provided', async () => {
      mockClient.chat.completions.create.mockResolvedValue(makeStream([
        { choices: [{ delta: {}, finish_reason: 'stop' }] },
      ]));

      const tools = [{ type: 'function', function: { name: 'foo' } }];
      for await (const _ of provider.chatStream({
        system: 'sys',
        messages: [],
        tools,
      })) {
        // noop
      }

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ tools })
      );
    });

    it('propagates API errors', async () => {
      mockClient.chat.completions.create.mockRejectedValue(new Error('stream error'));

      await expect(async () => {
        for await (const _ of provider.chatStream({
          system: 'test',
          messages: [],
        })) {
          // noop
        }
      }).rejects.toThrow('stream error');
    });
  });
});
