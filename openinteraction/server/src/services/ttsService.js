import { tts } from 'edge-tts/out/index.js';

const DEFAULT_VOICE = process.env.TTS_VOICE || 'zh-CN-XiaoxiaoNeural';

/**
 * Returns available voice options.
 */
export function getAvailableVoices() {
  return {
    default: DEFAULT_VOICE,
    alternatives: ['zh-CN-YunxiNeural', 'zh-CN-YunyangNeural', 'zh-CN-XiaoyiNeural'],
  };
}

/**
 * Synthesizes text to speech and returns the audio as a base64-encoded string.
 * @param {string} text - The text to synthesize
 * @param {string} [voice] - Voice name (defaults to DEFAULT_VOICE)
 * @returns {Promise<string>} Base64-encoded MP3 audio
 */
export async function synthesizeToBase64(text, voice = DEFAULT_VOICE) {
  const audioBuffer = await tts(text, { voice });
  return audioBuffer.toString('base64');
}
