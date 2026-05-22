import OpenAI from 'openai';

export class LLMProvider {
  constructor({ client, model } = {}) {
    this.client = client || new OpenAI({
      apiKey: process.env.LLM_API_KEY || 'test',
      baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    });
    this.model = model || process.env.LLM_MODEL || 'deepseek-chat';
  }

  async chat({ system, messages, tools = [] }) {
    const fullMessages = [
      { role: 'system', content: system },
      ...messages,
    ];

    const params = {
      model: this.model,
      messages: fullMessages,
    };

    if (tools.length > 0) {
      params.tools = tools;
    }

    const response = await this.client.chat.completions.create(params);
    const choice = response.choices[0];
    const message = choice.message;

    return {
      content: message.content || '',
      toolCalls: (message.tool_calls || []).map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
    };
  }

  async *chatStream({ system, messages, tools = [] }) {
    const fullMessages = [
      { role: 'system', content: system },
      ...messages,
    ];

    const params = {
      model: this.model,
      messages: fullMessages,
      stream: true,
    };

    if (tools.length > 0) {
      params.tools = tools;
    }

    const stream = await this.client.chat.completions.create(params);

    // Accumulate tool call deltas across chunks
    const toolCallMap = new Map();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      const finishReason = chunk.choices[0]?.finish_reason;

      if (delta.content) {
        yield { type: 'text', content: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallMap.has(idx)) {
            toolCallMap.set(idx, { id: tc.id || '', name: '', arguments: '' });
          }
          const entry = toolCallMap.get(idx);
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        }
      }

      if (finishReason === 'tool_calls') {
        const toolCalls = [...toolCallMap.values()].map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: JSON.parse(tc.arguments),
        }));
        yield { type: 'tool_call', toolCalls };
        yield { type: 'done', reason: 'tool_calls' };
        return;
      }

      if (finishReason === 'stop') {
        yield { type: 'done' };
        return;
      }
    }

    // Stream ended without a finish_reason (shouldn't normally happen)
    yield { type: 'done' };
  }
}
