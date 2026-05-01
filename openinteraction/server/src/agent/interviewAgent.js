import { getDb } from '../db/database.js';
import { ConversationManager } from '../services/conversationManager.js';
import { buildSystemPrompt } from './promptBuilder.js';
import { toolDefinitions, executeTool } from './tools.js';

export class InterviewAgent {
  constructor(interviewId, projectId, llmProvider) {
    this.interviewId = interviewId;
    this.projectId = projectId;
    this.llm = llmProvider;
    this.conversation = new ConversationManager(interviewId);
  }

  async processMessage(userMessage) {
    // Save user message
    this.conversation.addMessage('user', userMessage);

    // Load project config for system prompt
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(this.projectId);
    const systemPrompt = buildSystemPrompt(project);

    // Get conversation history
    const messages = this.conversation.getMessagesForLLM();

    try {
      // Call LLM
      const result = await this.llm.chat({
        system: systemPrompt,
        messages,
        tools: toolDefinitions,
      });

      // Process tool calls if any
      let finalResponse = result.content;
      let allToolCalls = [...result.toolCalls];
      let interviewStatus = 'in_progress';

      // Handle tool calls in a loop (agent might call multiple tools)
      let currentResult = result;
      let maxIterations = 5; // Safety limit

      while (currentResult.toolCalls.length > 0 && maxIterations > 0) {
        maxIterations--;

        for (const toolCall of currentResult.toolCalls) {
          executeTool(toolCall.name, toolCall.arguments, this.interviewId);

          if (toolCall.name === 'end_interview') {
            interviewStatus = 'completed';
          }
        }

        // Build tool call context messages for the next LLM call
        const toolCallMessages = currentResult.toolCalls.map(tc => ({
          role: 'assistant',
          content: null,
          tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } }],
        }));

        const toolResultMessages = currentResult.toolCalls.map(tc => ({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ success: true }),
        }));

        const nextMessages = [...messages, ...toolCallMessages, ...toolResultMessages];

        currentResult = await this.llm.chat({
          system: systemPrompt,
          messages: nextMessages,
          tools: toolDefinitions,
        });

        finalResponse = currentResult.content || finalResponse;
        allToolCalls = [...allToolCalls, ...currentResult.toolCalls];
      }

      // Save assistant message
      this.conversation.addMessage('assistant', finalResponse, allToolCalls.length > 0 ? allToolCalls : null);

      return {
        response: finalResponse,
        toolCalls: allToolCalls,
        interviewStatus,
      };
    } catch (error) {
      console.error('InterviewAgent error:', error);

      const errorMsg = '抱歉，我这边出了点小问题，你能再说一遍吗？';
      this.conversation.addMessage('assistant', errorMsg);

      return {
        response: errorMsg,
        toolCalls: [],
        interviewStatus: 'in_progress',
        error: error.message,
      };
    }
  }
}
