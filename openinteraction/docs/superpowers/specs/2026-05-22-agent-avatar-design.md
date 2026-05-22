# Agent Avatar — Dynamic Emotion Character Design

## Overview

Add a dynamic animated character to the left side of the interview chat interface. The character is a minimalist geometric SVG face that reacts to the agent's conversation state, providing visual feedback and making the interview experience more engaging.

## Goals

- Visual companion that reacts to conversation flow in real time
- Reinforce the "talking to a friend" feel from the agent's system prompt
- Lightweight implementation with zero new dependencies

## Emotion States

| State | Trigger | Visual |
|-------|---------|--------|
| `idle` | Before conversation, after stream ends | Normal eyes, flat mouth arc, breathing animation |
| `listening` | User sent message, waiting for LLM | Slightly larger eyes, small "o" mouth, head tilted forward |
| `thinking` | LLM calling tools (record_insight, etc.) | Half-squinted eyes, curved mouth, head tilted, floating thought bubble |
| `speaking` | LLM outputting text chunks | Normal eyes, mouth opening/closing animation, subtle mouth glow |
| `happy` | end_interview called | Crescent moon eyes, big smile arc, slight bounce scale |

## Architecture

### Frontend — New Components

**`AgentAvatar`** (`client/src/components/agent-avatar/AgentAvatar.tsx`)
- Renders SVG character with state-driven CSS transitions
- Props: `emotion: EmotionState`
- SVG elements: circle (head), two ellipses (eyes), path (mouth), optional dots (eyebrows)

**`AvatarPanel`** (`client/src/components/agent-avatar/AvatarPanel.tsx`)
- Fixed left panel wrapper
- Contains `AgentAvatar` + status text label below

**`agent-avatar.css`** (`client/src/components/agent-avatar/agent-avatar.css`)
- All keyframe animations and state transition styles

### Frontend — Modifications

**`ChatPage.tsx`**
- New state: `const [agentEmotion, setAgentEmotion] = useState<EmotionState>('idle')`
- Handle new SSE `emotion` event: `setAgentEmotion(event.state)`
- Render `<AvatarPanel emotion={agentEmotion} />` to the left of the existing chat content

**`chat.css`**
- Change `.chat` from `flex-direction: column` to `flex-direction: row`
- Right side container keeps the existing column layout

**`client/src/api/client.ts`**
- Extend `SSEEvent` interface: add `'emotion'` to type union, add optional `state: string` field

### Backend — Modifications

**`server/src/routes/chat.js`**
- Send `emotion` SSE events at key points in the stream:
  - After user message received, before LLM starts: `listening`
  - When text chunks start arriving: `speaking`
  - When agent yields a `tool_call` chunk: `thinking`
  - When `end_interview` tool is called: `happy`
  - On stream end: `idle`

**`server/src/agent/interviewAgent.js`**
- Yield new `{ type: 'emotion', state: '...' }` chunks in `processMessageStream`:
  - Before tool execution: `{ type: 'emotion', state: 'thinking' }`
  - After `end_interview` execution: `{ type: 'emotion', state: 'happy' }`

## SVG Character Design

### Elements

- **Head**: Large circle, fill `var(--color-text-secondary)` (#7A7E7D), subtle glass-morphism glow
- **Eyes**: Two ellipses, morph via `rx`/`ry` CSS transitions
- **Mouth**: SVG `<path>` arc, morph via `d` attribute or `ry` transitions
- **Thought bubble** (thinking state only): Small circle floating above head

### Colors

All aligned with existing `tokens.css` Morandi design system:
- Character body: `var(--color-text-secondary)` #7A7E7D
- Eye highlights: `var(--color-glass-highlight)` rgba(255,255,255,0.4)
- Panel background: `var(--color-glass)` rgba(255,255,255,0.22) + `backdrop-filter: blur`

### Animations

| Animation | Mechanism | Duration |
|-----------|-----------|----------|
| State transition | CSS `transition` on SVG attributes (`rx`, `ry`, `cx`, `cy`) | 400ms ease-in-out |
| Breathing | CSS `@keyframes` scale(1) → scale(1.02) | 3s infinite |
| Blinking | CSS `@keyframes` ry normal → 1px → normal | Every 4-6s |
| Mouth speaking | CSS `@keyframes` ry 2px → 6px | 0.6s loop |
| Thought bubble | CSS `@keyframes` translate + opacity | 2s loop |

## Layout

```
┌──────────────────────────────────────────┐
│              chat-header                  │
├────────┬─────────────────────────────────┤
│        │                                 │
│ Avatar │         MessageList             │
│ Panel  │                                 │
│ (固定)  │                                 │
│ 120px  │                                 │
│        ├─────────────────────────────────┤
│        │         MessageInput            │
├────────┴─────────────────────────────────┤
```

- `AvatarPanel`: fixed width 120px, `position: sticky; top: 0; height: 100dvh`, vertically centered
- Right side: existing column layout (header + MessageList + MessageInput)
- Mobile (< 768px): AvatarPanel hidden, avatar shrinks into header area

## SSE Event Flow

```
event: emotion   → {"state":"listening"}
event: text      → {"chunk":"你"}
event: emotion   → {"state":"speaking"}
event: text      → {"chunk":"好呀，"}
event: text      → {"chunk":"能聊聊"}
event: emotion   → {"state":"thinking"}
event: emotion   → {"state":"speaking"}
event: text      → {"chunk":"你的体验吗？"}
event: emotion   → {"state":"idle"}
event: done      → {"interview_status":"in_progress"}
```

## Implementation Notes

- No new npm dependencies — pure SVG + CSS transitions
- SVG path morphing for the mouth uses CSS `d` property transition (supported in modern browsers)
- Fallback: if `d` transition not supported, snap-change the mouth shape instead
- The emotion state is ephemeral — not persisted in the database
- Existing test suite should not be affected (no backend logic changes to agent tools)
