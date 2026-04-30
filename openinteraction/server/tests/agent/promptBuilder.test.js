import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/agent/promptBuilder.js';

describe('buildSystemPrompt', () => {
  const project = {
    name: 'TestApp',
    product_context: '一个在线购物平台，主要面向年轻用户',
    core_topics: JSON.stringify([
      { id: 'search', description: '搜索功能的体验' },
      { id: 'checkout', description: '下单支付流程' },
    ]),
    style_guide: JSON.stringify({ tone: 'casual' }),
  };

  it('includes role and style section', () => {
    const prompt = buildSystemPrompt(project);
    expect(prompt).toContain('朋友');
    expect(prompt).toContain('TestApp');
  });

  it('includes product context', () => {
    const prompt = buildSystemPrompt(project);
    expect(prompt).toContain('在线购物平台');
    expect(prompt).toContain('年轻用户');
  });

  it('includes core topics', () => {
    const prompt = buildSystemPrompt(project);
    expect(prompt).toContain('搜索功能');
    expect(prompt).toContain('下单支付');
  });

  it('includes tool usage instructions', () => {
    const prompt = buildSystemPrompt(project);
    expect(prompt).toContain('record_insight');
    expect(prompt).toContain('extract_annotation');
    expect(prompt).toContain('end_interview');
  });

  it('includes conversation strategy', () => {
    const prompt = buildSystemPrompt(project);
    expect(prompt).toContain('共情');
    expect(prompt).toContain('追问');
  });
});
