# Voice Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add voice input (STT via Web Speech API) and voice output (TTS via Edge TTS) to the interview chat, with synchronized text+audio streaming via SSE.

**Architecture:** Client uses Web Speech API for real-time speech-to-text. Server adds a new SSE endpoint (`POST /api/chat/stream`) that streams LLM text chunks and Edge TTS audio chunks simultaneously. Client plays audio chunks as they arrive while displaying text progressively.

**Tech Stack:** Web Speech API, edge-tts (npm), SSE (Server-Sent Events), AudioContext, React 19, Express 5

---

### Task 1: Install edge-tts dependency

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install edge-tts**

```bash
cd server && npm install edge-tts
```

- [ ] **Step 2: Verify installation**

Check that `edge-tts` appears in `server/package.json` dependencies.

- [ ] **Step 3: Commit**

```bash
cd server && git add package.json package-lock.json
git commit -m "deps: add edge-tts for server-side TTS"
```

---

### Task 2: Create TTS Service

**Files:**
- Create: `server/src/services/ttsService.js`
- Test: `server/tests/services/ttsService.test.js`

- [ ] **Step 1: Write failing tests for ttsService**

Create `server/tests/services/ttsService.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { synthesizeToBase64, getAvailableVoices } from '../../src/services/ttsService.js';

// Mock edge-tts
vi.mock('edge-tts', () => {
  const MockEdgeTTS = vi.fn().mockImplementation(() => ({
    synthesize: vi.fn().mockResolvedValue(undefined),
    toBuffer: vi.fn().mockReturnValue(Buffer.from([0xff, 0xfb, 0x90, 0x00])), // fake MP3 header
  }));
  return { EdgeTTS: MockEdgeTTS };
});

describe('ttsService', () => {
  describe('synthesizeToBase64', () => {
    it('is a function', () => {
      expect(typeof synthesizeToBase64).toBe('function');
    });

    it('returns a base64 string', async () => {
      const result = await synthesizeToBase64('你好');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Verify it's valid base64
      expect(Buffer.from(result, 'base64').length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableVoices', () => {
    it('returns default voice config', () => {
      const voices = getAvailableVoices();
      expect(voices).toHaveProperty('default');
      expect(voices.default).toContain('Xiaoxiao');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/services/ttsService.test.js
```

Expected: FAIL — module `ttsService.js` not found.

- [ ] **Step 3: Implement ttsService**

Create `server/src/services/ttsService.js`:

```javascript
import { EdgeTTS } from 'edge-tts';

const DEFAULT_VOICE = process.env.TTS_VOICE || 'zh-CN-XiaoxiaoNeural';

export function getAvailableVoices() {
  return {
    default: DEFAULT_VOICE,
    alternatives: [
      'zh-CN-YunxiNeural',
      'zh-CN-YunyangNeural',
      'zh-CN-XiaoyiNeural',
    ],
  };
}

export async function synthesizeToBase64(text, voice = DEFAULT_VOICE) {
  const tts = new EdgeTTS();
  await tts.synthesize(text, voice, { rate: '+0%', pitch: '+0Hz', volume: '+0%' });
  const audioBuffer = tts.toBuffer();
  return audioBuffer.toString('base64');
}
```

**Note:** After creating this file, verify the edge-tts API by checking `node_modules/edge-tts` exports. If `synthesize` or `toBuffer` don't exist, check the package's actual API (it may use `ttsPromise` or different method names) and adjust accordingly.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/services/ttsService.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/ttsService.js server/tests/services/ttsService.test.js
git commit -m "feat(server): add TTS service with Edge TTS"
```

---

### Task 3: Add streaming support to LLMProvider

**Files:**
- Modify: `server/src/llm/provider.js`
- Test: `server/tests/llm/provider.test.js`

- [ ] **Step 1: Write failing test for chatStream**

Add to `server/tests/llm/provider.test.js`:

```javascript
describe('chatStream', () => {
  it('returns an async iterable of text chunks', async () => {
    const mockStream = [
      { choices: [{ delta: { content: 'Hello' }, finish_reason: null }] },
      { choices: [{ delta: { content: ' world' }, finish_reason: null }] },
      { choices: [{ delta: {}, finish_reason: 'stop' }] },
    ];

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            [Symbol.asyncIterator]: async function* () {
              for (const chunk of mockStream) yield chunk;
            },
          }),
        },
      },
    };

    const provider = new LLMProvider({ client: mockClient, model: 'test' });
    const chunks = [];

    for await (const chunk of provider.chatStream({
      system: 'test',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { type: 'text', content: 'Hello' },
      { type: 'text', content: ' world' },
      { type: 'done' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run tests/llm/provider.test.js
```

Expected: FAIL — `chatStream` is not a function.

- [ ] **Step 3: Implement chatStream in LLMProvider**

Add to `server/src/llm/provider.js` after the `chat` method:

```javascript
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

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    if (delta?.content) {
      yield { type: 'text', content: delta.content };
    }

    if (delta?.tool_calls) {
      yield { type: 'tool_call', toolCalls: delta.tool_calls };
    }

    if (chunk.choices[0]?.finish_reason === 'stop') {
      yield { type: 'done' };
    }

    if (chunk.choices[0]?.finish_reason === 'tool_calls') {
      yield { type: 'done', reason: 'tool_calls' };
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/llm/provider.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/llm/provider.js server/tests/llm/provider.test.js
git commit -m "feat(server): add chatStream to LLMProvider for streaming responses"
```

---

### Task 4: Add processMessageStream to InterviewAgent

**Files:**
- Modify: `server/src/agent/interviewAgent.js`
- Test: `server/tests/agent/interviewAgent.test.js`

- [ ] **Step 1: Write failing test for processMessageStream**

Add to `server/tests/agent/interviewAgent.test.js`:

```javascript
describe('processMessageStream', () => {
  it('yields text chunks from LLM stream', async () => {
    const mockLLM = {
      chatStream: async function* () {
        yield { type: 'text', content: '你好' };
        yield { type: 'text', content: '！' };
        yield { type: 'done' };
      },
    };

    const agent = new InterviewAgent(interviewId, projectId, mockLLM);
    const chunks = [];

    for await (const chunk of agent.processMessageStream('你好')) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter(c => c.type === 'text');
    expect(textChunks.map(c => c.content)).toEqual(['你好', '！']);
    expect(chunks.some(c => c.type === 'done')).toBe(true);
  });
});
```

Note: The test setup (projectId, interviewId) must match the existing test file's `beforeEach`. Add this describe block inside the existing test structure.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run tests/agent/interviewAgent.test.js
```

Expected: FAIL — `processMessageStream` is not a function.

- [ ] **Step 3: Implement processMessageStream**

Add to `server/src/agent/interviewAgent.js` after `processMessage`:

```javascript
async *processMessageStream(userMessage) {
  this.conversation.addMessage('user', userMessage);

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(this.projectId);
  const systemPrompt = buildSystemPrompt(project);
  const messages = this.conversation.getMessagesForLLM();

  try {
    let fullResponse = '';
    let allToolCalls = [];
    let maxIterations = 5;

    let currentMessages = messages;

    while (maxIterations > 0) {
      maxIterations--;
      let iterationToolCalls = [];

      for await (const chunk of this.llm.chatStream({
        system: systemPrompt,
        messages: currentMessages,
        tools: toolDefinitions,
      })) {
        if (chunk.type === 'text') {
          fullResponse += chunk.content;
          yield chunk;
        }

        if (chunk.type === 'tool_call') {
          iterationToolCalls.push(...chunk.toolCalls);
        }

        if (chunk.type === 'done') {
          if (chunk.reason === 'tool_calls') {
            // Process accumulated tool calls
            break;
          }
        }
      }

      if (iterationToolCalls.length === 0) break;

      // Process tool calls
      for (const tc of iterationToolCalls) {
        const parsed = {
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        };
        executeTool(parsed.name, parsed.arguments, this.interviewId);
        allToolCalls.push(parsed);

        if (parsed.name === 'end_interview') {
          yield { type: 'interview_completed' };
        }
      }

      // Build tool call messages for next iteration
      const toolCallMessages = iterationToolCalls.map(tc => ({
        role: 'assistant',
        content: null,
        tool_calls: [tc],
      }));

      const toolResultMessages = iterationToolCalls.map(tc => ({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify({ success: true }),
      }));

      currentMessages = [...messages, ...toolCallMessages, ...toolResultMessages];
      fullResponse = '';
    }

    this.conversation.addMessage('assistant', fullResponse, allToolCalls.length > 0 ? allToolCalls : null);

    yield {
      type: 'done',
      interviewStatus: allToolCalls.some(tc => tc.name === 'end_interview') ? 'completed' : 'in_progress',
    };
  } catch (error) {
    console.error('InterviewAgent stream error:', error);
    const errorMsg = '抱歉，我这边出了点小问题，你能再说一遍吗？';
    this.conversation.addMessage('assistant', errorMsg);
    yield { type: 'error', message: error.message };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/agent/interviewAgent.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/agent/interviewAgent.js server/tests/agent/interviewAgent.test.js
git commit -m "feat(server): add processMessageStream AsyncGenerator to InterviewAgent"
```

---

### Task 5: Add SSE streaming endpoint

**Files:**
- Modify: `server/src/routes/chat.js`
- Test: `server/tests/routes/chat.test.js`

- [ ] **Step 1: Write failing test for SSE endpoint**

Add to `server/tests/routes/chat.test.js`:

```javascript
it('POST /api/chat/stream returns SSE events', async () => {
  // Mock the LLMProvider and InterviewAgent
  const mockStream = (async function* () {
    yield { type: 'text', content: '你好' };
    yield { type: 'text', content: '！' };
    yield { type: 'done', interviewStatus: 'in_progress' };
  })();

  const { InterviewAgent } = await import('../../src/agent/interviewAgent.js');
  vi.spyOn(InterviewAgent.prototype, 'processMessageStream').mockReturnValue(mockStream);

  const res = await request(app)
    .post('/api/chat/stream')
    .send({ interview_id: interviewId, message: '你好' })
    .expect(200)
    .expect('Content-Type', /text\/event-stream/);

  expect(res.text).toContain('event: text');
  expect(res.text).toContain('你好');
  expect(res.text).toContain('event: done');

  vi.restoreAllMocks();
});

it('POST /api/chat/stream requires interview_id and message', async () => {
  await request(app)
    .post('/api/chat/stream')
    .send({})
    .expect(400);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/routes/chat.test.js
```

Expected: FAIL — 404 for `/api/chat/stream`.

- [ ] **Step 3: Implement SSE endpoint**

Add to `server/src/routes/chat.js` before the `export default router;` line:

```javascript
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

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const llmProvider = new LLMProvider();
    const agent = new InterviewAgent(interview_id, interview.project_id, llmProvider);

    let ttsError = false;

    for await (const chunk of agent.processMessageStream(message)) {
      if (chunk.type === 'text') {
        sendSSE('text', { chunk: chunk.content });

        // Generate TTS audio for this chunk
        if (!ttsError) {
          try {
            const { synthesizeToBase64 } = await import('../services/ttsService.js');
            const audioBase64 = await synthesizeToBase64(chunk.content);
            sendSSE('audio', { chunk: audioBase64 });
          } catch (ttsErr) {
            console.error('TTS error, falling back to text-only:', ttsErr);
            ttsError = true;
          }
        }
      }

      if (chunk.type === 'done') {
        sendSSE('done', { interview_status: chunk.interviewStatus || 'in_progress' });
      }

      if (chunk.type === 'error') {
        sendSSE('error', { message: chunk.message });
      }
    }

    res.end();
  } catch (error) {
    console.error('Chat stream error:', error);
    sendSSE('error', { message: 'Internal server error' });
    res.end();
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/routes/chat.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/chat.js server/tests/routes/chat.test.js
git commit -m "feat(server): add POST /api/chat/stream SSE endpoint"
```

---

### Task 6: Add sendMessageStream to client API

**Files:**
- Modify: `client/src/api/client.ts`

- [ ] **Step 1: Add SSE event types and sendMessageStream function**

Add to `client/src/api/client.ts` after the `sendMessage` function:

```typescript
export interface SSEEvent {
  type: 'text' | 'audio' | 'done' | 'error';
  chunk?: string;
  interview_status?: string;
  message?: string;
}

export async function sendMessageStream(
  interviewId: string,
  message: string,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interview_id: interviewId, message }),
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as ApiError).error || 'Stream request failed');
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventType = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          onEvent({ type: eventType as SSEEvent['type'], ...parsed });
        } catch {
          // Skip malformed data
        }
        eventType = '';
      }
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/api/client.ts
git commit -m "feat(client): add sendMessageStream for SSE communication"
```

---

### Task 7: Create AudioPlayer component

**Files:**
- Create: `client/src/components/audio-player/AudioPlayer.tsx`
- Create: `client/src/components/audio-player/audio-player.css`

- [ ] **Step 1: Create AudioPlayer component**

Create `client/src/components/audio-player/AudioPlayer.tsx`:

```tsx
import { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import './audio-player.css';

export interface AudioPlayerHandle {
  enqueueChunk: (base64Chunk: string) => void;
  stop: () => void;
  replay: (allChunks: string[]) => void;
}

const AudioPlayer = forwardRef<AudioPlayerHandle>(function AudioPlayer(_props, ref) {
  const ctxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextTimeRef = useRef(0);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
      nextTimeRef.current = 0;
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const playNext = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || isPlayingRef.current || queueRef.current.length === 0) return;

    isPlayingRef.current = true;
    const buffer = queueRef.current.shift()!;

    ctx.decodeAudioData(buffer, (audioBuffer) => {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startTime = Math.max(ctx.currentTime, nextTimeRef.current);
      source.start(startTime);
      nextTimeRef.current = startTime + audioBuffer.duration;

      source.onended = () => {
        isPlayingRef.current = false;
        playNext();
      };
    }, (err) => {
      console.error('Audio decode error:', err);
      isPlayingRef.current = false;
      playNext();
    });
  }, []);

  const enqueueChunk = useCallback((base64Chunk: string) => {
    const binary = atob(base64Chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    queueRef.current.push(bytes.buffer);
    playNext();
  }, [playNext]);

  const stop = useCallback(() => {
    queueRef.current = [];
    isPlayingRef.current = false;
    nextTimeRef.current = 0;
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      ctxRef.current.close();
      ctxRef.current = null;
    }
  }, []);

  const replay = useCallback((allChunks: string[]) => {
    stop();
    for (const chunk of allChunks) {
      enqueueChunk(chunk);
    }
  }, [stop, enqueueChunk]);

  useImperativeHandle(ref, () => ({ enqueueChunk, stop, replay }), [enqueueChunk, stop, replay]);

  return null;
});

export default AudioPlayer;
```

Create `client/src/components/audio-player/audio-player.css`:

```css
/* AudioPlayer has no visible UI — it's a headless component */
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/audio-player/
git commit -m "feat(client): add AudioPlayer component for chunk-by-chunk playback"
```

---

### Task 8: Add microphone button and STT to MessageInput

**Files:**
- Modify: `client/src/components/message-input/MessageInput.tsx`
- Modify: `client/src/components/message-input/message-input.css`

- [ ] **Step 1: Add microphone button and Web Speech API integration**

Replace the content of `client/src/components/message-input/MessageInput.tsx`:

```tsx
import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import './message-input.css';

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  value?: string;
  onValueChange?: (next: string) => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

function MessageInput({ onSend, disabled = false, value, onValueChange }: MessageInputProps) {
  const isControlled = value !== undefined && onValueChange !== undefined;
  const [internal, setInternal] = useState('');
  const text = isControlled ? (value as string) : internal;
  const setText = (next: string) => {
    if (isControlled) onValueChange!(next);
    else setInternal(next);
  };
  const taRef = useRef<HTMLTextAreaElement>(null);

  // STT state
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseTextRef = useRef('');

  const supportsSTT = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text, interimText]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = true;

    baseTextRef.current = text;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        baseTextRef.current += finalTranscript;
        setText(baseTextRef.current);
        setInterimText('');
      } else {
        setInterimText(interimTranscript);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('请允许麦克风权限以使用语音输入');
      }
      stopRecording();
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        // Auto-restart if still recording (continuous mode may stop)
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setInterimText('');

    // Apply any remaining interim text as final
    if (interimText) {
      const newText = baseTextRef.current + interimText;
      setText(newText);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
    if (taRef.current) taRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  const displayText = interimText ? text + interimText : text;

  return (
    <form className="msg-input-container" onSubmit={submit}>
      <div className="msg-input-frame">
        <div className="msg-input-inner">
          <textarea
            ref={taRef}
            className={`msg-input-field ${interimText ? 'msg-input-field--interim' : ''}`}
            value={displayText}
            onChange={(e) => {
              const val = e.target.value;
              if (interimText) {
                // User is editing during interim — clear interim
                setInterimText('');
                baseTextRef.current = val;
              }
              setText(val);
            }}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? '正在听...' : '说说你的想法...'}
            disabled={disabled}
            rows={1}
          />
          {supportsSTT && (
            <button
              type="button"
              className={`msg-input-mic ${isRecording ? 'msg-input-mic--active' : ''}`}
              onClick={toggleRecording}
              disabled={disabled}
              aria-label={isRecording ? '停止录音' : '语音输入'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              {isRecording && <span className="msg-input-mic-time">{formatTime(recordingTime)}</span>}
            </button>
          )}
          <button
            type="submit"
            className="msg-input-submit"
            disabled={disabled || !text.trim()}
            aria-label="发送"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8L14 2L10 14L8 10L6 8L2 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </form>
  );
}

export default MessageInput;
```

- [ ] **Step 2: Add microphone styles to message-input.css**

Append to `client/src/components/message-input/message-input.css`:

```css
.msg-input-mic {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--radius-circle);
  background: var(--color-action-bg);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: var(--space-1);
  transition: background var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard);
}

.msg-input-mic:hover:not(:disabled) {
  background: var(--color-action-bg-hover);
  transform: scale(1.05);
}

.msg-input-mic--active {
  background: rgba(220, 80, 80, 0.6);
  animation: micPulse 1.5s infinite;
}

.msg-input-mic--active:hover {
  background: rgba(220, 80, 80, 0.7);
}

.msg-input-mic-time {
  font-size: 11px;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  min-width: 28px;
}

.msg-input-field--interim {
  font-style: italic;
  opacity: 0.7;
}

@keyframes micPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/message-input/
git commit -m "feat(client): add microphone button with Web Speech API to MessageInput"
```

---

### Task 9: Add replay button to agent messages

**Files:**
- Modify: `client/src/components/message-list/MessageList.tsx`
- Modify: `client/src/components/message-list/message-list.css`

- [ ] **Step 1: Update Message interface and add replay button**

Replace the content of `client/src/components/message-list/MessageList.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import './message-list.css';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  audioChunks?: string[];
}

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
  streamingContent?: string;
  isPlaying?: boolean;
  onReplay?: (audioChunks: string[]) => void;
  onStopAudio?: () => void;
}

function MessageList({ messages, loading = false, streamingContent, isPlaying, onReplay, onStopAudio }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, streamingContent]);

  return (
    <div className="msg-list">
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        return (
          <div key={i} className={`msg-row ${isUser ? 'msg-row--user' : 'msg-row--agent'}`}>
            {!isUser && <div className="msg-avatar msg-avatar--agent" aria-hidden="true" />}
            <div className={`msg-bubble ${isUser ? 'msg-bubble--user' : 'msg-bubble--agent'}`}>
              {msg.content}
              {!isUser && msg.audioChunks && msg.audioChunks.length > 0 && (
                <div className="msg-audio-controls">
                  {isPlaying ? (
                    <button className="msg-audio-btn" onClick={onStopAudio} aria-label="停止播放">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    </button>
                  ) : (
                    <button className="msg-audio-btn" onClick={() => onReplay?.(msg.audioChunks!)} aria-label="重新朗读">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2v6h-6" />
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                        <path d="M3 22v-6h6" />
                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {streamingContent && (
        <div className="msg-row msg-row--agent">
          <div className="msg-avatar msg-avatar--agent" aria-hidden="true" />
          <div className="msg-bubble msg-bubble--agent msg-bubble--streaming">
            {streamingContent}
          </div>
        </div>
      )}
      {loading && !streamingContent && (
        <div className="msg-row msg-row--agent">
          <div className="msg-avatar msg-avatar--agent" aria-hidden="true" />
          <div className="msg-bubble msg-bubble--agent msg-bubble--loading">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
        </div>
      )}
      {messages.length === 0 && !loading && !streamingContent && (
        <div className="msg-empty">
          <p className="msg-empty-text">开始对话吧</p>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export default MessageList;
```

- [ ] **Step 2: Add audio control styles**

Append to `client/src/components/message-list/message-list.css`:

```css
.msg-audio-controls {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-glass-border);
}

.msg-audio-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-circle);
  background: var(--color-action-bg);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard);
}

.msg-audio-btn:hover {
  background: var(--color-action-bg-hover);
  color: var(--color-text-primary);
}

.msg-bubble--streaming {
  opacity: 0.85;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/message-list/
git commit -m "feat(client): add replay button and streaming state to MessageList"
```

---

### Task 10: Integrate everything in ChatPage

**Files:**
- Modify: `client/src/pages/chat/ChatPage.tsx`
- Modify: `client/src/pages/chat/chat.css`

- [ ] **Step 1: Rewrite ChatPage with SSE streaming and audio**

Replace the content of `client/src/pages/chat/ChatPage.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getInterview, sendMessageStream, sendMessage } from '../../api/client';
import type { Interview, SSEEvent } from '../../api/client';
import MessageList from '../../components/message-list/MessageList';
import type { Message } from '../../components/message-list/MessageList';
import MessageInput from '../../components/message-input/MessageInput';
import AudioPlayer, { type AudioPlayerHandle } from '../../components/audio-player/AudioPlayer';
import './chat.css';

function ChatPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [interview, setInterview] = useState<Interview | null>(location.state?.interview ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const abortRef = useRef<AbortController | null>(null);
  const currentAudioChunksRef = useRef<string[]>([]);
  const streamedTextRef = useRef('');

  useEffect(() => {
    if (!interview && token) {
      getInterview(token).then(setInterview).catch(() => navigate(`/interview/${token}`));
    }
  }, [token, interview, navigate]);

  const handleStopAudio = useCallback(() => {
    audioPlayerRef.current?.stop();
    setIsPlaying(false);
  }, []);

  const handleReplay = useCallback((audioChunks: string[]) => {
    setIsPlaying(true);
    audioPlayerRef.current?.replay(audioChunks);
    // Estimate playback duration and reset state
    setTimeout(() => setIsPlaying(false), audioChunks.length * 200);
  }, []);

  const handleSend = async (text: string) => {
    if (!interview) return;

    const updated: Message[] = [...messages, { role: 'user' as const, content: text }];
    setMessages(updated);
    setLoading(true);
    setError(null);
    setStreamingContent('');
    streamedTextRef.current = '';
    currentAudioChunksRef.current = [];

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      await sendMessageStream(
        interview.interview_id,
        text,
        (event: SSEEvent) => {
          switch (event.type) {
            case 'text':
              streamedTextRef.current += event.chunk || '';
              setStreamingContent(streamedTextRef.current);
              break;
            case 'audio':
              if (event.chunk) {
                currentAudioChunksRef.current.push(event.chunk);
                audioPlayerRef.current?.enqueueChunk(event.chunk);
                if (!isPlaying) setIsPlaying(true);
              }
              break;
            case 'done': {
              const finalText = streamedTextRef.current;
              if (finalText) {
                setMessages(msgs => [...msgs, {
                  role: 'assistant' as const,
                  content: finalText,
                  audioChunks: [...currentAudioChunksRef.current],
                }]);
              }
              setStreamingContent('');
              if (event.interview_status === 'completed') {
                setTimeout(() => navigate(`/interview/${token}/complete`, { state: { interview } }), 2000);
              }
              break;
            }
            case 'error':
              setError(event.message || '流式响应出错');
              break;
          }
        },
        abortController.signal
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;

      // Fallback to non-streaming
      console.warn('SSE failed, falling back to POST /api/chat:', err);
      try {
        const result = await sendMessage(interview.interview_id, text);
        setMessages([...updated, { role: 'assistant' as const, content: result.response }]);
        if (result.interview_status === 'completed') {
          setTimeout(() => navigate(`/interview/${token}/complete`, { state: { interview } }), 2000);
        }
      } catch (fallbackErr: unknown) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : '发送失败，请重试');
      }
    } finally {
      setLoading(false);
      setIsPlaying(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="chat-header-dot" />
        <span className="chat-header-title">产品体验访谈</span>
      </div>
      <MessageList
        messages={messages}
        loading={loading}
        streamingContent={streamingContent}
        isPlaying={isPlaying}
        onReplay={handleReplay}
        onStopAudio={handleStopAudio}
      />
      {error && <div className="chat-error" role="alert">{error}</div>}
      <MessageInput onSend={handleSend} disabled={loading} />
      <AudioPlayer ref={audioPlayerRef} />
    </div>
  );
}

export default ChatPage;
```

- [ ] **Step 2: Add any needed CSS for streaming state in chat.css**

Read `client/src/pages/chat/chat.css` first, then append if needed. The streaming bubble styling is in message-list.css already, so chat.css likely needs no changes. Verify by reading it.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run dev server and test manually**

```bash
cd client && npm run dev
```

Open `http://localhost:5173`, navigate to an interview chat, verify:
1. Microphone button appears in the input area
2. Clicking mic starts recording (button turns red with timer)
3. Speaking shows real-time text in the input
4. Clicking mic again stops recording, text remains editable
5. Sending a message connects via SSE
6. Agent text appears progressively
7. Audio plays automatically as text streams
8. Refresh button appears on agent messages for replay

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/chat/ChatPage.tsx client/src/pages/chat/chat.css
git commit -m "feat(client): integrate SSE streaming and voice in ChatPage"
```

---

### Task 11: Run full test suite and final verification

**Files:** None (verification only)

- [ ] **Step 1: Run all server tests**

```bash
cd server && npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run client type check**

```bash
cd client && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run client build**

```bash
cd client && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: End-to-end manual test**

1. Start server: `cd server && npm run dev`
2. Start client: `cd client && npm run dev`
3. Create a project and interview via dashboard
4. Open interview link
5. Test voice input: click mic, speak, verify text appears in real-time
6. Send message, verify agent streams text + audio simultaneously
7. Test replay button on agent message
8. Test fallback: disable mic permission, verify text input still works

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address integration issues from manual testing"
```
