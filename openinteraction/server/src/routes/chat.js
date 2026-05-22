import { Router } from 'express';
import { getDb } from '../db/database.js';
import { LLMProvider } from '../llm/provider.js';
import { InterviewAgent } from '../agent/interviewAgent.js';
import { synthesizeToBase64 } from '../services/ttsService.js';

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

router.post('/stream', async (req, res) => {
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

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const llmProvider = new LLMProvider();
    const agent = new InterviewAgent(interview_id, interview.project_id, llmProvider);

    let ttsFailed = false;

    for await (const chunk of agent.processMessageStream(message)) {
      if (chunk.type === 'text') {
        sendEvent('text', { chunk: chunk.content });

        // Generate TTS audio for this text chunk
        if (!ttsFailed) {
          try {
            const audioBase64 = await synthesizeToBase64(chunk.content);
            sendEvent('audio', { chunk: audioBase64 });
          } catch (ttsError) {
            console.error('TTS error, disabling TTS for remaining chunks:', ttsError);
            ttsFailed = true;
          }
        }
      } else if (chunk.type === 'emotion') {
        sendEvent('emotion', { state: chunk.state });
      } else if (chunk.type === 'done') {
        sendEvent('done', { interview_status: chunk.interviewStatus });
      } else if (chunk.type === 'error') {
        sendEvent('error', { message: chunk.message });
      }
    }
  } catch (error) {
    console.error('Chat stream error:', error);
    sendEvent('error', { message: 'Internal server error' });
  } finally {
    res.end();
  }
});

export default router;
