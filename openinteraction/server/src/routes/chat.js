import { Router } from 'express';
import { getDb } from '../db/database.js';
import { LLMProvider } from '../llm/provider.js';
import { InterviewAgent } from '../agent/interviewAgent.js';

const router = Router();

router.post('/', async (req, res) => {
  const { interview_id, message } = req.body;

  if (!interview_id || !message) {
    return res.status(400).json({ error: 'interview_id and message are required' });
  }

  const db = getDb();
  const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interview_id);

  if (!interview) {
    return res.status(404).json({ error: 'Interview not found' });
  }

  if (interview.status !== 'in_progress') {
    return res.status(400).json({ error: 'Interview already completed' });
  }

  try {
    const llmProvider = new LLMProvider();
    const agent = new InterviewAgent(interview_id, interview.project_id, llmProvider);

    const result = await agent.processMessage(message);

    res.json({
      response: result.response,
      tool_calls: result.toolCalls,
      interview_status: result.interviewStatus,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
