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
});
