# Agent Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dynamic animated SVG character to the left side of the interview chat that reacts to the agent's conversation state with 5 emotions.

**Architecture:** Backend yields emotion states via SSE events during streaming. Frontend renders a pure CSS/SVG geometric face with smooth morph transitions between idle, listening, thinking, speaking, and happy states.

**Tech Stack:** React 19, TypeScript, CSS transitions/keyframes, SVG, Express SSE, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `server/src/agent/interviewAgent.js` | Yield `emotion` chunks during streaming |
| Modify | `server/src/routes/chat.js` | Forward emotion chunks as SSE events |
| Modify | `server/tests/routes/chat.test.js` | Test emotion SSE events in stream |
| Modify | `client/src/api/client.ts` | Extend `SSEEvent` with `emotion` type |
| Create | `client/src/components/agent-avatar/AgentAvatar.tsx` | SVG face component |
| Create | `client/src/components/agent-avatar/agent-avatar.css` | All animations and state styles |
| Create | `client/src/components/agent-avatar/AvatarPanel.tsx` | Left panel wrapper |
| Create | `client/src/components/agent-avatar/avatar-panel.css` | Panel layout styles |
| Modify | `client/src/pages/chat/ChatPage.tsx` | Add emotion state, render AvatarPanel |
| Modify | `client/src/pages/chat/chat.css` | Two-column layout with left panel |

---

### Task 1: Backend — Yield emotion states from InterviewAgent

**Files:**
- Modify: `server/src/agent/interviewAgent.js:119-175`

- [ ] **Step 1: Add emotion yields to processMessageStream**

In `server/src/agent/interviewAgent.js`, inside the `processMessageStream` method, add emotion yields at key points. The current streaming loop is at lines 121-175. Make these changes:

After line 119 (`let maxIterations = 5;`), before the while loop, yield listening:
```javascript
      yield { type: 'emotion', state: 'listening' };
```

Inside the while loop, after the `for await` loop over `stream` (after line 141), when tool calls are detected (line 149 `if (!toolCallsFromStream)`), add emotion yield before tool execution. Replace the tool execution block (lines 149-159) with:
```javascript
        // If no tool calls, we're done
        if (!toolCallsFromStream) {
          finalResponse = streamContent || finalResponse;
          break;
        }

        // Agent is thinking (calling tools)
        yield { type: 'emotion', state: 'thinking' };

        // Execute tool calls
        finalResponse = streamContent || finalResponse;
        allToolCalls = [...allToolCalls, ...toolCallsFromStream];

        for (const toolCall of toolCallsFromStream) {
          executeTool(toolCall.name, toolCall.arguments, this.interviewId);

          if (toolCall.name === 'end_interview') {
            interviewStatus = 'completed';
            yield { type: 'emotion', state: 'happy' };
          }
        }
```

Also, when text chunks are yielded (inside the `for await` loop at line 136), emit a speaking emotion on the first text chunk. Add a flag before the while loop:
```javascript
      let hasEmittedSpeaking = false;
```

Then inside the `for await` loop, before yielding text chunks, add:
```javascript
          if (chunk.type === 'text' && !hasEmittedSpeaking) {
            yield { type: 'emotion', state: 'speaking' };
            hasEmittedSpeaking = true;
          }
```

- [ ] **Step 2: Run existing tests to verify no regressions**

Run: `cd server && npx vitest run tests/agent/interviewAgent.test.js`
Expected: All existing tests pass (emotion yields are transparent to existing consumers).

- [ ] **Step 3: Commit**

```bash
git add server/src/agent/interviewAgent.js
git commit -m "feat(agent): yield emotion states during streaming"
```

---

### Task 2: Backend — Forward emotion events via SSE

**Files:**
- Modify: `server/src/routes/chat.js:79-98`
- Modify: `server/tests/routes/chat.test.js`

- [ ] **Step 1: Write the failing test for emotion SSE events**

In `server/tests/routes/chat.test.js`, update the mock in `Chat Stream Routes` to include emotion yields. Replace the default mock (lines 105-108) with:
```javascript
    mockProcessMessageStream = async function* () {
      yield { type: 'emotion', state: 'listening' };
      yield { type: 'text', content: '你好！' };
      yield { type: 'emotion', state: 'speaking' };
      yield { type: 'text', content: '很高兴认识你。' };
      yield { type: 'emotion', state: 'idle' };
      yield { type: 'done', interviewStatus: 'in_progress' };
    };
```

Then add a new test after the existing "sends text, audio, and done SSE events" test (after line 170):
```javascript
  it('POST /api/chat/stream sends emotion SSE events', async () => {
    const res = await request(app)
      .post('/api/chat/stream')
      .send({ interview_id: interviewId, message: '你好' });

    const body = res.text;

    // Should contain emotion events
    expect(body).toContain('event: emotion');
    expect(body).toContain('"state":"listening"');
    expect(body).toContain('"state":"speaking"');
    expect(body).toContain('"state":"idle"');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/routes/chat.test.js`
Expected: The new test FAILS because `chat.js` does not yet forward emotion events.

- [ ] **Step 3: Implement emotion event forwarding in chat.js**

In `server/src/routes/chat.js`, modify the `for await` loop (lines 79-98) to handle emotion chunks. Add a new `else if` branch after the `text` type check (after line 87):
```javascript
      } else if (chunk.type === 'emotion') {
        sendEvent('emotion', { state: chunk.state });
      } else if (chunk.type === 'done') {
```

The full loop becomes:
```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run tests/routes/chat.test.js`
Expected: All tests PASS, including the new emotion event test.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/chat.js server/tests/routes/chat.test.js
git commit -m "feat(chat): forward emotion SSE events to client"
```

---

### Task 3: Frontend — Extend SSEEvent type

**Files:**
- Modify: `client/src/api/client.ts:52-57`

- [ ] **Step 1: Add emotion to SSEEvent interface**

In `client/src/api/client.ts`, update the `SSEEvent` interface (lines 52-57):

```typescript
export interface SSEEvent {
  type: 'text' | 'audio' | 'done' | 'error' | 'emotion';
  chunk?: string;
  interview_status?: string;
  message?: string;
  state?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/api/client.ts
git commit -m "feat(types): add emotion to SSEEvent interface"
```

---

### Task 4: Frontend — Create AgentAvatar SVG component

**Files:**
- Create: `client/src/components/agent-avatar/AgentAvatar.tsx`
- Create: `client/src/components/agent-avatar/agent-avatar.css`

- [ ] **Step 1: Create the AgentAvatar component**

Create `client/src/components/agent-avatar/AgentAvatar.tsx`:

```tsx
import './agent-avatar.css';

export type EmotionState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy';

interface AgentAvatarProps {
  emotion: EmotionState;
}

function AgentAvatar({ emotion }: AgentAvatarProps) {
  return (
    <div className={`avatar avatar--${emotion}`} aria-label={`Agent is ${emotion}`}>
      <svg
        className="avatar-svg"
        viewBox="0 0 120 140"
        width="120"
        height="140"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Thought bubble — only visible in thinking state */}
        <circle
          className="avatar-bubble avatar-bubble-1"
          cx="90" cy="18"
          r="5"
        />
        <circle
          className="avatar-bubble avatar-bubble-2"
          cx="100" cy="8"
          r="3"
        />
        <circle
          className="avatar-bubble avatar-bubble-3"
          cx="106" cy="0"
          r="2"
        />

        {/* Head */}
        <circle
          className="avatar-head"
          cx="60" cy="65"
          r="45"
        />

        {/* Left eye */}
        <ellipse
          className="avatar-eye avatar-eye--left"
          cx="44" cy="58"
          rx="7" ry="7"
        />
        {/* Left eye highlight */}
        <circle
          className="avatar-eye-highlight avatar-eye-highlight--left"
          cx="42" cy="55"
          r="2.5"
        />

        {/* Right eye */}
        <ellipse
          className="avatar-eye avatar-eye--right"
          cx="76" cy="58"
          rx="7" ry="7"
        />
        {/* Right eye highlight */}
        <circle
          className="avatar-eye-highlight avatar-eye-highlight--right"
          cx="74" cy="55"
          r="2.5"
        />

        {/* Mouth */}
        <ellipse
          className="avatar-mouth"
          cx="60" cy="82"
          rx="12" ry="3"
        />
      </svg>
    </div>
  );
}

export default AgentAvatar;
```

- [ ] **Step 2: Create the agent-avatar CSS**

Create `client/src/components/agent-avatar/agent-avatar.css`:

```css
/* === Base === */
.avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.avatar-svg {
  overflow: visible;
}

/* === Head === */
.avatar-head {
  fill: var(--color-text-secondary);
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08));
  transform-origin: 60px 65px;
  transition: transform 400ms ease-in-out;
}

/* === Eyes === */
.avatar-eye {
  fill: var(--color-text-strong);
  transition: rx 400ms ease-in-out, ry 400ms ease-in-out, cy 400ms ease-in-out;
}

.avatar-eye-highlight {
  fill: var(--color-glass-highlight);
  transition: opacity 400ms ease-in-out;
}

/* === Mouth === */
.avatar-mouth {
  fill: var(--color-text-strong);
  transition: rx 400ms ease-in-out, ry 400ms ease-in-out, cy 400ms ease-in-out;
}

/* === Thought bubble (hidden by default) === */
.avatar-bubble {
  fill: var(--color-text-secondary);
  opacity: 0;
  transition: opacity 300ms ease-in-out;
}

/* === Breathing animation (idle only) === */
.avatar--idle .avatar-head {
  animation: breathe 3s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

/* === Blink animation (idle only) === */
.avatar--idle .avatar-eye {
  animation: blink 4.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 42%, 46%, 100% { ry: 7; }
  44% { ry: 1; }
}

/* === IDLE state === */
.avatar--idle .avatar-eye {
  rx: 7;
  ry: 7;
}

.avatar--idle .avatar-mouth {
  rx: 12;
  ry: 3;
  cy: 82;
}

/* === LISTENING state === */
.avatar--listening .avatar-head {
  transform: translateY(3px);
}

.avatar--listening .avatar-eye {
  rx: 8;
  ry: 8;
}

.avatar--listening .avatar-mouth {
  rx: 6;
  ry: 6;
  cy: 84;
}

/* === THINKING state === */
.avatar--thinking .avatar-head {
  transform: rotate(-5deg);
}

.avatar--thinking .avatar-eye {
  rx: 7;
  ry: 4;
}

.avatar--thinking .avatar-mouth {
  rx: 10;
  ry: 3;
  d: path("M 48 82 Q 60 78 72 82");
}

.avatar--thinking .avatar-bubble {
  opacity: 0.6;
  animation: bubbleFloat 2s ease-in-out infinite;
}

.avatar--thinking .avatar-bubble-1 { animation-delay: 0s; }
.avatar--thinking .avatar-bubble-2 { animation-delay: 0.3s; }
.avatar--thinking .avatar-bubble-3 { animation-delay: 0.6s; }

@keyframes bubbleFloat {
  0%, 100% { transform: translateY(0); opacity: 0.6; }
  50% { transform: translateY(-4px); opacity: 0.9; }
}

/* === SPEAKING state === */
.avatar--speaking .avatar-eye {
  rx: 7;
  ry: 7;
}

.avatar--speaking .avatar-mouth {
  rx: 12;
  ry: 3;
  animation: mouthSpeak 0.6s ease-in-out infinite;
}

@keyframes mouthSpeak {
  0%, 100% { ry: 3; }
  50% { ry: 6; }
}

/* === HAPPY state === */
.avatar--happy .avatar-eye {
  rx: 7;
  ry: 2;
  cy: 56;
}

.avatar--happy .avatar-eye-highlight {
  opacity: 0;
}

.avatar--happy .avatar-mouth {
  rx: 16;
  ry: 8;
  cy: 80;
}

.avatar--happy .avatar-head {
  animation: happyBounce 600ms ease-out;
}

@keyframes happyBounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.06); }
  60% { transform: scale(0.98); }
  100% { transform: scale(1); }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/agent-avatar/AgentAvatar.tsx client/src/components/agent-avatar/agent-avatar.css
git commit -m "feat(avatar): create AgentAvatar SVG component with 5 emotion states"
```

---

### Task 5: Frontend — Create AvatarPanel wrapper

**Files:**
- Create: `client/src/components/agent-avatar/AvatarPanel.tsx`
- Create: `client/src/components/agent-avatar/avatar-panel.css`

- [ ] **Step 1: Create AvatarPanel component**

Create `client/src/components/agent-avatar/AvatarPanel.tsx`:

```tsx
import AgentAvatar from './AgentAvatar';
import type { EmotionState } from './AgentAvatar';
import './avatar-panel.css';

interface AvatarPanelProps {
  emotion: EmotionState;
}

const emotionLabels: Record<EmotionState, string> = {
  idle: '',
  listening: '在听你说...',
  thinking: '让我想想...',
  speaking: '',
  happy: '聊得很开心！',
};

function AvatarPanel({ emotion }: AvatarPanelProps) {
  const label = emotionLabels[emotion];

  return (
    <aside className="avatar-panel">
      <AgentAvatar emotion={emotion} />
      {label && <p className="avatar-panel-label">{label}</p>}
    </aside>
  );
}

export default AvatarPanel;
```

- [ ] **Step 2: Create avatar-panel CSS**

Create `client/src/components/agent-avatar/avatar-panel.css`:

```css
.avatar-panel {
  width: 120px;
  min-width: 120px;
  height: 100dvh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  background: var(--color-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-right: 1px solid var(--color-glass-border);
}

.avatar-panel-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: center;
  letter-spacing: var(--letter-spacing-base);
  margin: 0;
  padding: 0 var(--space-2);
  min-height: 1.2em;
  transition: opacity 300ms ease;
}

/* Mobile: hide panel */
@media (max-width: 768px) {
  .avatar-panel {
    display: none;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/agent-avatar/AvatarPanel.tsx client/src/components/agent-avatar/avatar-panel.css
git commit -m "feat(avatar): create AvatarPanel left sidebar component"
```

---

### Task 6: Frontend — Integrate AvatarPanel into ChatPage

**Files:**
- Modify: `client/src/pages/chat/ChatPage.tsx`
- Modify: `client/src/pages/chat/chat.css`

- [ ] **Step 1: Update chat.css for two-column layout**

Replace the `.chat` rule in `client/src/pages/chat/chat.css` (lines 1-8):

```css
.chat {
  height: 100dvh;
  display: flex;
  flex-direction: row;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100dvh;
  position: relative;
  overflow: hidden;
}
```

The rest of `chat.css` (`.chat-header`, `.chat-error`, etc.) stays unchanged — those rules will now apply inside `.chat-main`.

- [ ] **Step 2: Integrate AvatarPanel into ChatPage**

In `client/src/pages/chat/ChatPage.tsx`, make these changes:

1. Add imports at the top (after line 8):
```typescript
import AvatarPanel from '../../components/agent-avatar/AvatarPanel';
import type { EmotionState } from '../../components/agent-avatar/AgentAvatar';
```

2. Add emotion state (after line 21, near other state declarations):
```typescript
  const [agentEmotion, setAgentEmotion] = useState<EmotionState>('idle');
```

3. Handle the `emotion` SSE event. In the `handleSend` function's SSE callback (inside the `switch` statement at line 74), add a new case before `case 'done':`:
```typescript
            case 'emotion':
              setAgentEmotion(event.state as EmotionState);
              break;
```

4. Also reset emotion to `'listening'` when user sends a message (after line 62, `setStreamingContent('')`):
```typescript
    setAgentEmotion('listening');
```

5. Also reset to `'idle'` on error (inside the `case 'error':` handler, after line 109):
```typescript
              setAgentEmotion('idle');
```

6. Also reset to `'idle'` in the fallback non-streaming catch (after the fallback `setMessages` call around line 126):
```typescript
        setAgentEmotion('idle');
```

7. Update the JSX return (replace lines 143-162) to wrap everything in the two-column layout:
```tsx
    <div className="chat">
      <AvatarPanel emotion={agentEmotion} />
      <div className="chat-main">
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
    </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Verify dev server starts**

Run: `cd client && npm run dev`
Expected: Vite dev server starts without errors. Visit `http://localhost:5173` to confirm the chat page loads with the avatar panel on the left.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/chat/ChatPage.tsx client/src/pages/chat/chat.css
git commit -m "feat(chat): integrate AvatarPanel with emotion state tracking"
```

---

### Task 7: Frontend — Mobile responsive: avatar in header

**Files:**
- Modify: `client/src/pages/chat/ChatPage.tsx`
- Modify: `client/src/pages/chat/chat.css`

- [ ] **Step 1: Add mobile avatar to ChatPage JSX**

In `client/src/pages/chat/ChatPage.tsx`, add a small avatar inside the header for mobile. Update the header div:

```tsx
        <div className="chat-header">
          <div className="chat-header-avatar-mobile">
            <AvatarPanel emotion={agentEmotion} />
          </div>
          <span className="chat-header-dot" />
          <span className="chat-header-title">产品体验访谈</span>
        </div>
```

- [ ] **Step 2: Add mobile CSS rules**

Append to `client/src/pages/chat/chat.css`:

```css
/* Mobile avatar in header */
.chat-header-avatar-mobile {
  display: none;
}

@media (max-width: 768px) {
  .chat-header-avatar-mobile {
    display: flex;
    position: absolute;
    left: var(--space-4);
    top: 50%;
    transform: translateY(-50%);
  }

  .chat-header-avatar-mobile .avatar-panel {
    display: flex;
    width: auto;
    min-width: auto;
    height: auto;
    position: static;
    background: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border-right: none;
  }

  .chat-header-avatar-mobile .avatar-svg {
    width: 36px;
    height: 42px;
  }

  .chat-header-avatar-mobile .avatar-panel-label {
    display: none;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd client && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/chat/ChatPage.tsx client/src/pages/chat/chat.css
git commit -m "feat(chat): add mobile responsive avatar in header"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Run all server tests**

Run: `cd server && npm test`
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript check**

Run: `cd client && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Manual smoke test**

1. Start server: `cd server && npm run dev`
2. Start client: `cd client && npm run dev`
3. Create a project and interview via dashboard
4. Open the interview chat link
5. Verify:
   - Avatar panel visible on the left with idle breathing animation
   - Send a message → avatar switches to listening, then speaking as text streams
   - If agent calls a tool → avatar shows thinking state briefly
   - When stream ends → avatar returns to idle
6. Resize browser to < 768px → avatar panel hides, small avatar appears in header

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(avatar): polish after smoke test"
```
