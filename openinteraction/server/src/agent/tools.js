import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';

export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'record_insight',
      description: 'Record a key insight from the user. Use when the user shares an important observation, feeling, or experience about the product.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic this insight relates to' },
          insight: { type: 'string', description: 'Summary of the insight' },
          emotion: { type: 'string', description: 'User\'s emotional state (e.g., frustrated, happy, neutral)' },
          quote: { type: 'string', description: 'User\'s original words (in Chinese)' },
        },
        required: ['topic', 'insight'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_topic_covered',
      description: 'Mark a core interview topic as discussed. Use when a topic has been sufficiently explored.',
      parameters: {
        type: 'object',
        properties: {
          topic_id: { type: 'string', description: 'ID of the core topic from the project config' },
          coverage: { type: 'string', enum: ['partial', 'full'], description: 'How thoroughly the topic was covered' },
          notes: { type: 'string', description: 'Brief notes about what was discussed' },
        },
        required: ['topic_id', 'coverage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract_annotation',
      description: 'Extract a structured annotation from the conversation. Use when the user shares something that can be categorized (pain point, feature request, positive feedback, usage pattern).',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['pain_point', 'feature_request', 'positive_feedback', 'usage_pattern'], description: 'Category of the annotation' },
          label: { type: 'string', description: 'Short label for the annotation' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'How significant this is' },
          quote: { type: 'string', description: 'User\'s original words' },
          context: { type: 'string', description: 'Additional context about why this was annotated' },
        },
        required: ['category', 'label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'end_interview',
      description: 'Signal that the interview can end. Use when all core topics are covered and the user has nothing more to add.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why the interview is ending' },
          summary: { type: 'string', description: 'Brief summary of what was discussed' },
        },
        required: ['reason', 'summary'],
      },
    },
  },
];

export function executeTool(name, args, interviewId) {
  const db = getDb();

  switch (name) {
    case 'record_insight': {
      const id = uuid();
      const context = args.emotion ? `[emotion: ${args.emotion}] ${args.insight}` : args.insight;
      db.prepare(
        'INSERT INTO annotations (id, interview_id, category, label, severity, quote, context) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, interviewId, 'insight', args.topic, null, args.quote || null, context);
      return { success: true, id };
    }

    case 'mark_topic_covered': {
      const id = uuid();
      db.prepare(
        'INSERT INTO annotations (id, interview_id, category, label, severity, context) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, interviewId, 'topic_coverage', `${args.topic_id}:${args.coverage}`, null, args.notes || null);
      return { success: true };
    }

    case 'extract_annotation': {
      const id = uuid();
      db.prepare(
        'INSERT INTO annotations (id, interview_id, category, label, severity, quote, context) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, interviewId, args.category, args.label, args.severity || null, args.quote || null, args.context || null);
      return { success: true, id };
    }

    case 'end_interview': {
      const endTx = db.transaction(() => {
        db.prepare(
          "UPDATE interviews SET status = 'completed', ended_at = datetime('now') WHERE id = ?"
        ).run(interviewId);
        const id = uuid();
        db.prepare(
          'INSERT INTO annotations (id, interview_id, category, label, context) VALUES (?, ?, ?, ?, ?)'
        ).run(id, interviewId, 'summary', 'interview_summary', `${args.reason}\n\n${args.summary}`);
      });
      endTx();
      return { success: true, summary: args.summary };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
