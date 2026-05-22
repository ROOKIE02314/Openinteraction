import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock edge-tts before importing the service
vi.mock('edge-tts/out/index.js', () => ({
  tts: vi.fn(),
  getVoices: vi.fn(),
}));

import { tts, getVoices } from 'edge-tts/out/index.js';
import { synthesizeToBase64, getAvailableVoices } from '../../src/services/ttsService.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAvailableVoices', () => {
  it('returns default voice and alternatives', () => {
    const result = getAvailableVoices();
    expect(result).toHaveProperty('default');
    expect(result).toHaveProperty('alternatives');
    expect(Array.isArray(result.alternatives)).toBe(true);
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it('uses zh-CN-XiaoxiaoNeural as default voice', () => {
    const result = getAvailableVoices();
    expect(result.default).toBe('zh-CN-XiaoxiaoNeural');
  });
});

describe('synthesizeToBase64', () => {
  it('calls edge-tts tts with text and default voice', async () => {
    const mockBuffer = Buffer.from('fake-audio-data');
    tts.mockResolvedValue(mockBuffer);

    const result = await synthesizeToBase64('Hello world');

    expect(tts).toHaveBeenCalledWith('Hello world', { voice: 'zh-CN-XiaoxiaoNeural' });
    expect(result).toBe(mockBuffer.toString('base64'));
  });

  it('calls edge-tts tts with custom voice', async () => {
    const mockBuffer = Buffer.from('fake-audio-data');
    tts.mockResolvedValue(mockBuffer);

    await synthesizeToBase64('Test text', 'zh-CN-YunxiNeural');

    expect(tts).toHaveBeenCalledWith('Test text', { voice: 'zh-CN-YunxiNeural' });
  });

  it('returns base64 encoded audio', async () => {
    const audioContent = Buffer.from([0xff, 0xfb, 0x90, 0x00]); // fake MP3 header
    tts.mockResolvedValue(audioContent);

    const result = await synthesizeToBase64('Test');

    expect(result).toBe(audioContent.toString('base64'));
    // Verify it's valid base64
    expect(Buffer.from(result, 'base64')).toEqual(audioContent);
  });

  it('propagates errors from edge-tts', async () => {
    tts.mockRejectedValue(new Error('TTS synthesis failed'));

    await expect(synthesizeToBase64('Test')).rejects.toThrow('TTS synthesis failed');
  });

  it('handles empty text', async () => {
    const mockBuffer = Buffer.alloc(0);
    tts.mockResolvedValue(mockBuffer);

    const result = await synthesizeToBase64('');

    expect(tts).toHaveBeenCalledWith('', { voice: 'zh-CN-XiaoxiaoNeural' });
    expect(result).toBe('');
  });
});
