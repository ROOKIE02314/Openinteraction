# Frontend Rebuild Plan — Variant.com Design Style

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the openinteraction frontend using variant.com's dark-theme glass-morphism design language, replacing the original inline-style approach with a polished design system.

**Architecture:** React + Vite + TypeScript SPA. Three pages (Landing, Chat, Completion) served via react-router-dom. Backend API is already live — the client hits `GET /api/interview/:token` and `POST /api/chat`. Design tokens defined as CSS custom properties. Components styled with scoped CSS modules — no CSS-in-JS, no Tailwind.

**Tech Stack:** React 19, Vite 6, TypeScript 5, react-router-dom 7, Inter font (Google Fonts)

---

## File Structure

```
client/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   └── client.ts
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── typography.css
│   │   └── global.css
│   ├── pages/
│   │   ├── landing/
│   │   │   ├── LandingPage.tsx
│   │   │   └── landing.css
│   │   ├── chat/
│   │   │   ├── ChatPage.tsx
│   │   │   └── chat.css
│   │   └── complete/
│   │       ├── CompletePage.tsx
│   │       └── complete.css
│   └── components/
│       ├── surface/
│       │   ├── SurfaceCard.tsx
│       │   └── surface.css
│       ├── message-list/
│       │   ├── MessageList.tsx
│       │   └── message-list.css
│       └── message-input/
│           ├── MessageInput.tsx
│           └── message-input.css
```

---

## API Contract (Existing Backend)

### `GET /api/interview/:token`
Response: `{ interview_id: string, status: string, project_name: string, started_at: string }`

### `POST /api/chat`
Body: `{ interview_id: string, message: string }`
Response: `{ response: string, tool_calls: Array<unknown>, interview_status: "in_progress" | "completed" }`

---

## Task 1: Client Project Setup

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`

- [ ] **Step 1: Create package.json**

Write `client/package.json`:

```json
{
  "name": "openinteraction-client",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.5.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "typescript": "~5.7.0",
    "vite": "^6.2.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Write `client/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

Write `client/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 4: Create index.html**

Write `client/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
    <title>产品体验访谈</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create main.tsx**

Write `client/src/main.tsx`:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 6: Create App.tsx**

Write `client/src/App.tsx`:

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/landing/LandingPage';
import ChatPage from './pages/chat/ChatPage';
import CompletePage from './pages/complete/CompletePage';

function App() {
  return (
    <Routes>
      <Route path="/interview/:token" element={<LandingPage />} />
      <Route path="/interview/:token/chat" element={<ChatPage />} />
      <Route path="/interview/:token/complete" element={<CompletePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
```

- [ ] **Step 7: Install dependencies and verify**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction/client && npm install && npx tsc --noEmit
```

Expected: TypeScript compiles without errors. `npm run dev` starts on port 5173.

- [ ] **Step 8: Commit**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction
git add client/package.json client/package-lock.json client/tsconfig.json client/vite.config.ts client/index.html client/src/main.tsx client/src/App.tsx
git commit -m "feat: initialize React + Vite + TypeScript client project"
```

---

## Task 2: Design System — CSS Tokens, Typography, Global Styles

**Files:**
- Create: `client/src/styles/tokens.css`
- Create: `client/src/styles/typography.css`
- Create: `client/src/styles/global.css`

- [ ] **Step 1: Write CSS tokens**

Write `client/src/styles/tokens.css`:

```css
:root {
  --color-black: #000000;
  --color-surface: #1e1e1c;
  --color-surface-raised: rgba(51, 51, 51, 0.9);
  --color-surface-hover: rgba(255, 255, 255, 0.06);

  --color-white: #ffffff;
  --color-white-85: rgba(255, 255, 255, 0.85);
  --color-white-50: rgba(255, 255, 255, 0.5);
  --color-white-40: rgba(255, 255, 255, 0.4);
  --color-white-07: rgba(255, 255, 255, 0.07);

  --border-thin: inset 0 0 0 0.5px rgba(255, 255, 255, 0.1);

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --blur-glass: blur(20px);

  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  --duration-fast: 120ms;
  --duration-normal: 250ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

- [ ] **Step 2: Write typography styles**

Write `client/src/styles/typography.css`:

```css
body {
  font-family: var(--font-sans);
  font-weight: 400;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-white-85);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

h1 {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.02em;
  color: var(--color-white-85);
}

p {
  color: var(--color-white-50);
  font-size: 15px;
  line-height: 1.65;
}

.text-muted {
  color: var(--color-white-40);
  font-size: 13px;
}
```

- [ ] **Step 3: Write global styles**

Write `client/src/styles/global.css`:

```css
@import './tokens.css';
@import './typography.css';

*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  color-scheme: dark;
  -webkit-text-size-adjust: 100%;
}

body {
  background: var(--color-black);
  min-height: 100dvh;
  overflow-x: hidden;
}

#root {
  min-height: 100dvh;
}

::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

::selection {
  background: rgba(255, 255, 255, 0.15);
  color: var(--color-white-85);
}
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction
git add client/src/styles/
git commit -m "feat: add design system CSS tokens, typography, and global styles"
```

---

## Task 3: API Client Layer

**Files:**
- Create: `client/src/api/client.ts`

- [ ] **Step 1: Write API client**

Write `client/src/api/client.ts`:

```typescript
export interface Interview {
  interview_id: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  project_name: string;
  started_at: string;
}

interface ChatResponse {
  response: string;
  tool_calls: unknown[];
  interview_status: 'in_progress' | 'completed';
}

interface ApiError {
  error: string;
}

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error((data as ApiError).error || 'Request failed');
  }

  return data as T;
}

export function getInterview(token: string): Promise<Interview> {
  return request<Interview>(`/interview/${token}`);
}

export function sendMessage(
  interviewId: string,
  message: string
): Promise<ChatResponse> {
  return request<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ interview_id: interviewId, message }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction
git add client/src/api/
git commit -m "feat: add typed API client for interview and chat endpoints"
```

---

## Task 4: SurfaceCard Component

**Files:**
- Create: `client/src/components/surface/SurfaceCard.tsx`
- Create: `client/src/components/surface/surface.css`

- [ ] **Step 1: Write SurfaceCard**

Write `client/src/components/surface/SurfaceCard.tsx`:

```typescript
import { type ReactNode } from 'react';
import './surface.css';

interface SurfaceCardProps {
  children: ReactNode;
  className?: string;
}

function SurfaceCard({ children, className = '' }: SurfaceCardProps) {
  return (
    <div className={`surface-card ${className}`}>
      {children}
    </div>
  );
}

export default SurfaceCard;
```

- [ ] **Step 2: Write surface styles**

Write `client/src/components/surface/surface.css`:

```css
.surface-card {
  background: var(--color-surface-raised);
  border-radius: var(--radius-lg);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    var(--border-thin);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction
git add client/src/components/surface/
git commit -m "feat: add SurfaceCard glass-morphism wrapper component"
```

---

## Task 5: Landing Page

**Files:**
- Create: `client/src/pages/landing/LandingPage.tsx`
- Create: `client/src/pages/landing/landing.css`

- [ ] **Step 1: Write LandingPage**

Write `client/src/pages/landing/LandingPage.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInterview } from '../../api/client';
import type { Interview } from '../../api/client';
import SurfaceCard from '../../components/surface/SurfaceCard';
import './landing.css';

function LandingPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    getInterview(token)
      .then((data) => {
        setInterview(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '访谈链接无效或已过期');
        setLoading(false);
      });
  }, [token]);

  const handleStart = () => {
    if (!token) return;
    navigate(`/interview/${token}/chat`, { state: { interview } });
  };

  if (loading) {
    return (
      <div className="landing">
        <SurfaceCard className="landing-card">
          <div className="landing-loader" />
        </SurfaceCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="landing">
        <SurfaceCard className="landing-card landing-card--error">
          <p className="landing-card-icon">—</p>
          <h1>链接无效</h1>
          <p>{error}</p>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="landing">
      <SurfaceCard className="landing-card">
        <p className="landing-card-icon">,</p>
        <h1 className="landing-title">Hi，想跟你聊聊~</h1>
        <p className="landing-desc">
          我们想了解一下你使用「{interview?.project_name}」的体验，
          就像朋友间随便聊聊，没有标准答案，想到什么说什么就好。
        </p>
        <p className="landing-duration">大概需要 10－15 分钟</p>
        <button className="landing-btn" onClick={handleStart}>
          开始聊天
        </button>
      </SurfaceCard>
    </div>
  );
}

export default LandingPage;
```

- [ ] **Step 2: Write landing styles**

Write `client/src/pages/landing/landing.css`:

```css
.landing {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.landing-card {
  max-width: 440px;
  width: 100%;
  padding: var(--space-12) var(--space-8);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.landing-card-icon {
  font-size: 40px;
  line-height: 1;
  margin-bottom: var(--space-2);
  color: var(--color-white-40);
  user-select: none;
}

.landing-title {
  margin-bottom: var(--space-2);
}

.landing-desc {
  max-width: 360px;
  margin: 0 auto;
}

.landing-duration {
  color: var(--color-white-40);
  font-size: 13px;
  margin-top: var(--space-2);
}

.landing-btn {
  margin-top: var(--space-6);
  padding: 12px 48px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-white-85);
  color: var(--color-black);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition:
    transform var(--duration-fast) var(--ease-out-expo),
    opacity var(--duration-fast) var(--ease-out-expo);
}

.landing-btn:hover {
  opacity: 0.9;
  transform: scale(1.02);
}

.landing-btn:active {
  transform: scale(0.98);
}

.landing-card--error {
  gap: var(--space-3);
}

.landing-loader {
  width: 48px;
  height: 48px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction
git add client/src/pages/landing/
git commit -m "feat: add landing page with glass-morphism SurfaceCard"
```

---

## Task 6: MessageList Component

**Files:**
- Create: `client/src/components/message-list/MessageList.tsx`
- Create: `client/src/components/message-list/message-list.css`

- [ ] **Step 1: Write MessageList**

Write `client/src/components/message-list/MessageList.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import './message-list.css';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
}

function MessageList({ messages, loading = false }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="msg-list">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`msg-row ${msg.role === 'user' ? 'msg-row--user' : 'msg-row--agent'}`}
        >
          {msg.role === 'assistant' && (
            <div className="msg-avatar msg-avatar--agent" aria-hidden="true" />
          )}
          <div className={`msg-bubble ${msg.role === 'user' ? 'msg-bubble--user' : 'msg-bubble--agent'}`}>
            {msg.content}
          </div>
        </div>
      ))}

      {loading && (
        <div className="msg-row msg-row--agent">
          <div className="msg-avatar msg-avatar--agent" aria-hidden="true" />
          <div className="msg-bubble msg-bubble--agent msg-bubble--loading">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
        </div>
      )}

      {messages.length === 0 && !loading && (
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

- [ ] **Step 2: Write message-list styles**

Write `client/src/components/message-list/message-list.css`:

```css
.msg-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.msg-row {
  display: flex;
  gap: var(--space-2);
  max-width: 85%;
}

.msg-row--user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.msg-row--agent {
  align-self: flex-start;
}

.msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
}

.msg-avatar--agent {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: var(--border-thin);
}

.msg-bubble {
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.55;
  max-width: 100%;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}

.msg-bubble--agent {
  background: var(--color-surface);
  border-radius: var(--radius-md) var(--radius-md) var(--radius-md) var(--radius-sm);
  color: var(--color-white-85);
  box-shadow: var(--border-thin);
}

.msg-bubble--user {
  background: rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md) var(--radius-md) var(--radius-sm) var(--radius-md);
  color: var(--color-white-85);
  box-shadow: var(--border-thin);
}

.msg-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.msg-empty-text {
  color: var(--color-white-40);
  font-size: 14px;
}

.msg-bubble--loading {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 14px 18px;
}

.loading-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-white-40);
  animation: dotPulse 1.4s ease-in-out infinite;
}

.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction
git add client/src/components/message-list/
git commit -m "feat: add MessageList component with loading dots animation"
```

---

## Task 7: MessageInput Component

**Files:**
- Create: `client/src/components/message-input/MessageInput.tsx`
- Create: `client/src/components/message-input/message-input.css`

- [ ] **Step 1: Write MessageInput**

Write `client/src/components/message-input/MessageInput.tsx`:

```typescript
import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react';
import './message-input.css';

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <form className="msg-input-container" onSubmit={submit}>
      <div className="msg-input-frame">
        <div className="msg-input-inner">
          <textarea
            ref={textareaRef}
            className="msg-input-field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="说说你的想法..."
            disabled={disabled}
            rows={1}
          />
          <button
            type="submit"
            className="msg-input-submit"
            disabled={disabled || !text.trim()}
            aria-label="发送"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8L14 2L10 14L8 10L6 8L2 8Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </form>
  );
}

export default MessageInput;
```

- [ ] **Step 2: Write message-input styles**

Write `client/src/components/message-input/message-input.css`:

```css
.msg-input-container {
  padding: var(--space-3) var(--space-4);
  padding-top: 0;
}

.msg-input-frame {
  border-radius: var(--radius-md);
  box-shadow: var(--border-thin);
  background: var(--color-surface);
}

.msg-input-inner {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  padding: 8px 8px 8px 12px;
}

.msg-input-field {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-white-85);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.55;
  resize: none;
  outline: none;
  min-height: 24px;
  max-height: 160px;
  overflow-y: auto;
}

.msg-input-field::placeholder {
  color: var(--color-white-40);
  user-select: none;
}

.msg-input-field::-webkit-scrollbar {
  display: none;
}

.msg-input-submit {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-white-50);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background var(--duration-fast) var(--ease-out-expo),
    color var(--duration-fast) var(--ease-out-expo);
}

.msg-input-submit:hover:not(:disabled) {
  background: var(--color-white-07);
  color: var(--color-white-85);
}

.msg-input-submit:disabled {
  opacity: 0.3;
  cursor: default;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction
git add client/src/components/message-input/
git commit -m "feat: add MessageInput component with auto-resize textarea"
```

---

## Task 8: Chat Page

**Files:**
- Create: `client/src/pages/chat/ChatPage.tsx`
- Create: `client/src/pages/chat/chat.css`

- [ ] **Step 1: Write ChatPage**

Write `client/src/pages/chat/ChatPage.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getInterview, sendMessage } from '../../api/client';
import type { Interview } from '../../api/client';
import MessageList from '../../components/message-list/MessageList';
import MessageInput from '../../components/message-input/MessageInput';
import type { Message } from '../../components/message-list/MessageList';
import './chat.css';

function ChatPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [interview, setInterview] = useState<Interview | null>(
    location.state?.interview ?? null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!interview && token) {
      getInterview(token)
        .then(setInterview)
        .catch(() => navigate(`/interview/${token}`));
    }
  }, [token, interview, navigate]);

  const handleSend = async (text: string) => {
    if (!interview) return;

    const updated: Message[] = [...messages, { role: 'user' as const, content: text }];
    setMessages(updated);
    setLoading(true);
    setError(null);

    try {
      const result = await sendMessage(interview.interview_id, text);
      setMessages([...updated, { role: 'assistant' as const, content: result.response }]);

      if (result.interview_status === 'completed') {
        setTimeout(() => {
          navigate(`/interview/${token}/complete`, { state: { interview } });
        }, 2000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '发送失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="chat-header-dot" />
        <span className="chat-header-title">产品体验访谈</span>
      </div>

      <MessageList messages={messages} loading={loading} />

      {error && (
        <div className="chat-error" role="alert">
          {error}
        </div>
      )}

      <MessageInput onSend={handleSend} disabled={loading} />
    </div>
  );
}

export default ChatPage;
```

- [ ] **Step 2: Write chat styles**

Write `client/src/pages/chat/chat.css`:

```css
.chat {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-black);
  max-width: 640px;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
  background: transparent;
}

.chat-header-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
}

.chat-header-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-white-50);
  letter-spacing: 0.01em;
}

.chat-error {
  padding: 6px var(--space-4);
  text-align: center;
  color: rgba(255, 100, 100, 0.8);
  font-size: 13px;
  background: rgba(255, 60, 60, 0.08);
  border-top: 0.5px solid rgba(255, 60, 60, 0.15);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction
git add client/src/pages/chat/
git commit -m "feat: add chat page with full message flow"
```

---

## Task 9: Completion Page

**Files:**
- Create: `client/src/pages/complete/CompletePage.tsx`
- Create: `client/src/pages/complete/complete.css`

- [ ] **Step 1: Write CompletePage**

Write `client/src/pages/complete/CompletePage.tsx`:

```typescript
import SurfaceCard from '../../components/surface/SurfaceCard';
import './complete.css';

function CompletePage() {
  return (
    <div className="complete">
      <SurfaceCard className="complete-card">
        <div className="complete-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <path
              d="M14 20.5L18.5 25L26 17"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1>聊完啦，谢谢你！</h1>
        <p>
          感谢你抽出时间分享使用体验，你的反馈对我们非常重要。
          每一条建议我们都会认真对待。
        </p>
        <p className="complete-sub">你可以关闭这个页面了</p>
      </SurfaceCard>
    </div>
  );
}

export default CompletePage;
```

- [ ] **Step 2: Write completion styles**

Write `client/src/pages/complete/complete.css`:

```css
.complete {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.complete-card {
  max-width: 440px;
  width: 100%;
  padding: var(--space-12) var(--space-8);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.complete-icon {
  margin-bottom: var(--space-2);
}

.complete-sub {
  margin-top: var(--space-2);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction
git add client/src/pages/complete/
git commit -m "feat: add interview completion page"
```

---

## Task 10: E2E Verification

**Files:**
- No new files — verification only

- [ ] **Step 1: TypeScript check**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction/client && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Start both servers and verify**

```bash
# Terminal 1 - Backend
cd /Volumes/data/projects/Openinteraction/openinteraction/server && npm run dev

# Terminal 2 - Frontend
cd /Volumes/data/projects/Openinteraction/openinteraction/client && npm run dev
```

- [ ] **Step 3: Manual walkthrough**

Create a test project + interview via API, then open the share link. Verify:
1. Landing page: glass card, project name, "开始聊天" button
2. Chat page: messages, input, loading dots
3. Completion: checkmark, thank you text
4. All colors match variant.com style (dark theme, thin borders, opacity text)

- [ ] **Step 4: Commit any fixes**

```bash
cd /Volumes/data/projects/Openinteraction/openinteraction
git add -A && git commit -m "fix: E2E verification polish"
```
