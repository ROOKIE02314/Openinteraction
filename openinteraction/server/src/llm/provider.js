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
}
