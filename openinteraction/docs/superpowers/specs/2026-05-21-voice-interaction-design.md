# Voice Interaction System Design

**Date**: 2026-05-21
**Status**: Draft
**Scope**: Add voice input (STT) and voice output (TTS) to the interview chat interface

## Overview

Users speak their answers during AI interviews, and the agent responds with both text and synchronized voice. The goal is a natural, conversational experience where text and audio stream simultaneously.

## Requirements

- Users click a microphone button to start/stop recording
- Speech is transcribed in real-time and displayed in the text input box (interim results shown in lighter style)
- Users can edit the transcribed text before sending
- Agent responses stream both text and audio simultaneously via SSE
- Audio playback is automatic; a refresh-style button allows replaying any agent message
- Graceful degradation: if STT or TTS fails, the system falls back to text-only

## Architecture

```
User speaks → Web Speech API → text → displayed in input box → user edits → sends
                                                                          ↓
                                                                POST /api/chat/stream (SSE)
                                                                          ↓
                                                               InterviewAgent.processMessageStream()
                                                                          ↓
                                                                LLM streams text chunks
                                                                          ↓
                                                          SSE endpoint does two things:
                                                          ├─ sends text chunks to client
                                                          └─ calls Edge TTS per chunk → sends audio chunks
                                                                          ↓
                                                          Client displays text + plays audio in sync
```

## Components

### 1. Speech-to-Text (Client)

**Technology**: Web Speech API (`SpeechRecognition`)
**Browser support**: Chrome, Edge only

**Behavior**:
- Microphone button placed inside the message input area (right side, next to send button)
- Click mic → start recording, button turns red with pulse animation, show recording duration
- `interimResults: true` — real-time transcription displayed in text input as user speaks
- Interim text shown in lighter color/italic to distinguish from final results
- User stops speaking → interim becomes final
- Click mic again → stop recording, final text fixed in input box, editable before sending

**Error handling**:
- Browser doesn't support Web Speech API → hide mic button, text input only
- User denies mic permission → toast with guidance
- Recognition failure (network/noise) → toast, preserve existing input content

### 2. Text-to-Speech (Server)

**Technology**: Edge TTS (`edge-tts` npm package)
**Default voice**: `zh-CN-XiaoxiaoNeural` (Xiaoxiao, female, natural Chinese)
**Configurable via**: `TTS_VOICE` environment variable

**Audio format**: MP3 (default output of edge-tts, widely supported by `AudioContext.decodeAudioData`)

**Implementation**:
- New file: `server/src/services/ttsService.js`
- Wraps edge-tts library, exposes `synthesizeStream(text)` returning audio chunks
- Called per text chunk from the LLM stream
- Returns base64-encoded MP3 audio chunks via SSE

### 3. SSE Streaming Endpoint (Server)

**New endpoint**: `POST /api/chat/stream`

**Request**: `{ interview_id: string, message: string }`

**Response**: SSE event stream with event types:

| Event Type | Data | Description |
|------------|------|-------------|
| `text` | `{ chunk: string }` | LLM text chunk, display immediately |
| `audio` | `{ chunk: string }` | Base64-encoded audio chunk, play in sequence |
| `done` | `{ interview_status: string }` | Stream complete |
| `error` | `{ message: string }` | Error occurred |

**Server-side flow**:
1. Validate request (same as existing POST `/api/chat`)
2. Instantiate InterviewAgent, call new `processMessageStream()` method
3. For each text chunk from LLM:
   - Send `text` SSE event immediately
   - Send chunk to Edge TTS for audio synthesis
   - Send resulting `audio` SSE event
4. Execute tool calls as normal within the stream loop
5. Send `done` event with final interview status

### 4. Agent Stream Method (Server)

**Modified file**: `server/src/agent/interviewAgent.js`

**New method**: `processMessageStream(message)` — returns an `AsyncGenerator` that yields text chunks

- Same logic as `processMessage()` but uses LLM streaming mode
- Tool calls are still handled (accumulated from stream, executed after full response)
- Yields `{ type: 'text', content }` and `{ type: 'tool_call', ... }` events

### 5. Client SSE + Audio Playback

**Modified file**: `client/src/api/client.ts`

**New method**: `sendMessageStream(interviewId, message)` — returns `ReadableStream` of parsed SSE events

**ChatPage changes**:
- New state: `isStreaming`, `audioContext`, `audioQueue`
- When streaming: connect to SSE, process events
- `text` events → append to current agent message in real-time
- `audio` events → decode base64, queue for playback via `AudioContext`
- `done` events → finalize message, save to DB status
- `error` events → fall back to POST `/api/chat` (existing flow)

**Audio playback**:
- Use `AudioContext` + `AudioBufferSourceNode` for chunk-by-chunk playback
- Maintain playback queue to ensure sequential play
- "Stop playback" button visible during playback

### 6. UI Changes

**MessageInput component** (`client/src/components/message-input/MessageInput.tsx`):
- Add microphone button (left of text area or right of send button)
- Recording state: red pulse animation + duration counter
- Interim results: lighter text style in input field

**MessageList component** (`client/src/components/message-list/MessageList.tsx`):
- Agent messages get a toolbar below the text
- Refresh button (replay icon ↻): replays cached audio for that message
- Audio waveform animation while agent is speaking

**New component**: `client/src/components/audio-player/AudioPlayer.tsx`
- Manages AudioContext lifecycle
- Handles chunk queue and sequential playback
- Exposes play/stop/replay controls

## Graceful Degradation

| Failure | Fallback |
|---------|----------|
| Web Speech API not supported | Hide mic button, text input only |
| Mic permission denied | Toast + text input only |
| STT recognition failure | Toast, preserve input content |
| Edge TTS call fails | Pure text streaming, no audio |
| Audio playback fails | Silent fallback, text still displays |
| SSE connection drops | Fall back to POST `/api/chat` |

## Files to Create/Modify

### New Files
- `server/src/services/ttsService.js` — Edge TTS wrapper
- `client/src/components/audio-player/AudioPlayer.tsx` — Audio playback manager

### Modified Files
- `server/src/routes/chat.js` — Add `POST /stream` SSE endpoint
- `server/src/agent/interviewAgent.js` — Add `processMessageStream()` AsyncGenerator
- `server/package.json` — Add `edge-tts` dependency
- `client/src/api/client.ts` — Add `sendMessageStream()` method
- `client/src/pages/chat/ChatPage.tsx` — Integrate SSE + audio playback
- `client/src/components/message-input/MessageInput.tsx` — Add mic button + real-time transcription
- `client/src/components/message-list/MessageList.tsx` — Add replay button on agent messages

### Unchanged
- InterviewAgent tool call logic (handled within stream)
- Database schema (messages stored as text)
- Existing `POST /api/chat` endpoint (kept as fallback)
- All other pages and components

## Testing

- **Server**: Vitest tests for SSE endpoint + TTS service (mock Edge TTS)
- **Client**: Manual testing (no automated test framework)
- **Integration**: End-to-end test of voice input → agent response → audio playback
