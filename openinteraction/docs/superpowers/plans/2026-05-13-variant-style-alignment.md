# Variant.com 风格对齐与样式架构重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 client 端三个页面 + 两个组件的样式架构从"内联 style 对象"全面迁移回"CSS 文件 + tokens.css 变量"，并补齐 variant.com 设计模板里缺失的视觉细节（多层阴影、弹性缓动、玻璃分层、字母间距、透明玻璃 CTA）。

**Architecture:** 根治 commit 572ffde 遗留的白屏问题 —— 其根因并非 createBrowserRouter 的失效，而是组件使用内联 style 后，各自的 `.css` 文件没被任何模块 import，导致 Vite 没打包它们。本次重构：(1) 每个组件 / 页面顶部加 `import './xxx.css'`；(2) 删除内联 `S` 对象，改用 className；(3) 扩展 tokens.css 的令牌表；(4) CTA 和卡片按 variant.com 原版风格重构。每个 task 一个 commit，便于回滚。

**Tech Stack:** React 18 + Vite + TypeScript（纯 CSS，不引入 Tailwind）；样式统一用 CSS 变量 `var(--xxx)` 引用 tokens.css。

---

## 文件责任与范围

**修改的现有文件：**
- `client/src/styles/tokens.css` — 扩展设计令牌
- `client/src/styles/typography.css` — 补字母间距、字重
- `client/src/styles/global.css` — 全局字母间距
- `client/src/pages/landing/landing.css` — 重写 CTA；加玻璃卡片
- `client/src/pages/landing/LandingPage.tsx` — 移除内联，用 className
- `client/src/pages/chat/chat.css` — 保持，仅微调
- `client/src/pages/chat/ChatPage.tsx` — 移除内联，用 className
- `client/src/pages/complete/complete.css` — 加玻璃卡片
- `client/src/pages/complete/CompletePage.tsx` — 移除内联，用 className
- `client/src/components/message-list/MessageList.tsx` — 移除内联，用 className
- `client/src/components/message-input/MessageInput.tsx` — 移除内联，用 className
- `client/src/router.tsx` — 移除内联 HomePage，改引用新文件

**新建文件：**
- `client/src/pages/home/HomePage.tsx` — 从 router.tsx 抽离
- `client/src/pages/home/home.css` — HomePage 样式

**删除文件：**
- `client/src/App.tsx` — 死代码（main.tsx 只用 router.tsx，不导入 App.tsx）

---

## 前置检查

- [ ] **Step 0: 确认 client 依赖已安装，server 端 .env 存在**

```bash
ls D:/school-business/openinteraction/client/node_modules/react 2>/dev/null && echo "client deps OK" || echo "run: cd client && npm install"
ls D:/school-business/openinteraction/server/.env 2>/dev/null && echo "server env OK" || echo "create .env with LLM_API_KEY"
```

预期：输出 "client deps OK" 与 "server env OK"。如缺失，先安装 / 创建。

---

### Task 1：扩展 tokens.css 补齐设计令牌

**Files:**
- Modify: `client/src/styles/tokens.css`

variant.com 模板里有多个关键令牌目前 tokens.css 没覆盖，后续任务会用到，先一次性扩展完毕。

- [ ] **Step 1: 替换 tokens.css 完整内容**

```css
:root {
  /* === 颜色：基底 === */
  --color-black: #000000;
  --color-surface: #1e1e1c;
  --color-surface-raised: rgba(34, 34, 34, 0.85);
  --color-surface-floating: rgba(0, 0, 0, 0.75);
  --color-surface-hover: rgba(255, 255, 255, 0.06);

  /* === 颜色：白色透明度层级（variant.com 18 级的精简） === */
  --color-white: #ffffff;
  --color-white-85: rgba(255, 255, 255, 0.85);
  --color-white-50: rgba(255, 255, 255, 0.5);
  --color-white-40: rgba(255, 255, 255, 0.4);
  --color-white-12: rgba(255, 255, 255, 0.12);
  --color-white-10: rgba(255, 255, 255, 0.1);
  --color-white-07: rgba(255, 255, 255, 0.07);
  --color-white-05: rgba(255, 255, 255, 0.05);

  /* === 颜色：品牌强调色 === */
  --color-blue-primary: #2688f9;
  --color-blue-brand: rgb(37, 99, 235);

  /* === 边框（0.5px 描边的标准实现） === */
  --border-thin: inset 0 0 0 0.5px rgba(255, 255, 255, 0.1);
  --border-hover: inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);

  /* === 阴影 === */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 8px 20px rgba(0, 0, 0, 0.25);
  --shadow-modal:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.2),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.1);

  /* === 圆角 === */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 14px;

  /* === 模糊 === */
  --blur-glass: blur(20px);
  --blur-glass-strong: blur(25px);

  /* === 间距（4/8px 网格） === */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* === 动效 === */
  --duration-fast: 120ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --ease-standard: cubic-bezier(0.175, 0.885, 0.32, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.19, 1, 0.22, 1);

  /* === 字体 === */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --letter-spacing-base: 0.01em;
  --letter-spacing-tight: -0.02em;
}
```

- [ ] **Step 2: 验证 CSS 无语法错误**

```bash
cd D:/school-business/openinteraction/client && npx --no-install vite build --mode development 2>&1 | head -20
```

预期：不出现 "Unexpected token" / "CSS parse error"。如报"找不到 vite"，先 `npm install`。

- [ ] **Step 3: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/styles/tokens.css
git commit -m "style(tokens): expand tokens with variant.com design tokens (shadows, spring easing, blur levels, letter-spacing)"
```

---

### Task 2：精修 typography.css + global.css 全局字母间距

**Files:**
- Modify: `client/src/styles/typography.css`
- Modify: `client/src/styles/global.css`

- [ ] **Step 1: 替换 typography.css**

```css
body {
  font-family: var(--font-sans);
  font-weight: var(--font-weight-regular);
  font-size: 14px;
  line-height: 1.6;
  letter-spacing: var(--letter-spacing-base);
  color: var(--color-white-85);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

h1 {
  font-size: 28px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
  letter-spacing: var(--letter-spacing-tight);
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

- [ ] **Step 2: global.css 无需改动，仅确认引入顺序**

阅读 `client/src/styles/global.css` 前 2 行：
```css
@import './tokens.css';
@import './typography.css';
```
确认顺序正确（tokens 先于 typography）。若已满足，跳过本步。

- [ ] **Step 3: Commit**

```bash
git add client/src/styles/typography.css
git commit -m "style(typography): apply global letter-spacing and reference weight tokens"
```

---

### Task 3：LandingPage — 迁移到 CSS + 重写玻璃 CTA

**Files:**
- Modify: `client/src/pages/landing/landing.css`
- Modify: `client/src/pages/landing/LandingPage.tsx`

**重点：** CTA 按钮从"白实底 + 黑字" 改为 variant.com 原版的"透明底 + 0.5px 白描边 + hover 轻微填充"。

- [ ] **Step 1: 替换 landing.css 完整内容**

```css
.landing {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-black);
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
  background: var(--color-surface-raised);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-modal);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
}

.landing-card--error {
  gap: var(--space-3);
}

.landing-icon {
  font-size: 40px;
  line-height: 1;
  margin-bottom: var(--space-2);
  color: var(--color-white-40);
  user-select: none;
}

.landing-title {
  margin-bottom: var(--space-2);
  font-size: 28px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-white-85);
  line-height: 1.3;
  letter-spacing: var(--letter-spacing-tight);
}

.landing-desc {
  max-width: 360px;
  margin: 0 auto;
  color: var(--color-white-50);
  font-size: 15px;
  line-height: 1.65;
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
  background: transparent;
  color: var(--color-white-85);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-base);
  cursor: pointer;
  box-shadow: var(--border-thin);
  transition:
    background var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.landing-btn:hover {
  background: var(--color-white-10);
  box-shadow: var(--border-hover);
}

.landing-btn:active {
  transform: scale(0.98);
}

.landing-loader {
  width: 48px;
  height: 48px;
  border: 2px solid var(--color-white-10);
  border-top-color: var(--color-white-40);
  border-radius: 50%;
  animation: landingSpin 0.8s linear infinite;
}

@keyframes landingSpin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: 替换 LandingPage.tsx 完整内容**

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInterview } from '../../api/client';
import type { Interview } from '../../api/client';
import './landing.css';

function LandingPage() {
  const { token } = useParams();
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
        <div className="landing-card">
          <div className="landing-loader" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="landing">
        <div className="landing-card landing-card--error">
          <p className="landing-icon">—</p>
          <h1 className="landing-title">链接无效</h1>
          <p className="landing-desc">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <p className="landing-icon">,</p>
        <h1 className="landing-title">Hi，想跟你聊聊~</h1>
        <p className="landing-desc">
          我们想了解一下你使用「{interview?.project_name}」的体验，
          就像朋友间随便聊聊，没有标准答案，想到什么说什么就好。
        </p>
        <p className="landing-duration">大概需要 10－15 分钟</p>
        <button className="landing-btn" onClick={handleStart}>
          开始聊天
        </button>
      </div>
    </div>
  );
}

export default LandingPage;
```

- [ ] **Step 3: 运行类型检查**

```bash
cd D:/school-business/openinteraction/client && npx tsc --noEmit
```

预期：无报错。

- [ ] **Step 4: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/pages/landing/
git commit -m "refactor(landing): migrate to CSS file + tokens; rework CTA to transparent glass button"
```

---

### Task 4：ChatPage — 迁移到 CSS + tokens

**Files:**
- Modify: `client/src/pages/chat/chat.css`
- Modify: `client/src/pages/chat/ChatPage.tsx`

- [ ] **Step 1: 替换 chat.css（补背景 + 标题字体强调）**

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
  background: var(--color-white-40);
}

.chat-header-title {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--color-white-50);
  letter-spacing: var(--letter-spacing-base);
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

- [ ] **Step 2: 替换 ChatPage.tsx 完整内容**

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getInterview, sendMessage } from '../../api/client';
import type { Interview } from '../../api/client';
import MessageList from '../../components/message-list/MessageList';
import MessageInput from '../../components/message-input/MessageInput';
import type { Message } from '../../components/message-list/MessageList';
import './chat.css';

function ChatPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [interview, setInterview] = useState<Interview | null>(location.state?.interview ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!interview && token) {
      getInterview(token).then(setInterview).catch(() => navigate(`/interview/${token}`));
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
        setTimeout(() => navigate(`/interview/${token}/complete`, { state: { interview } }), 2000);
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
      {error && <div className="chat-error" role="alert">{error}</div>}
      <MessageInput onSend={handleSend} disabled={loading} />
    </div>
  );
}

export default ChatPage;
```

- [ ] **Step 3: 类型检查**

```bash
cd D:/school-business/openinteraction/client && npx tsc --noEmit
```

预期：无报错。

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/chat/
git commit -m "refactor(chat): migrate ChatPage to CSS file + tokens"
```

---

### Task 5：CompletePage — 迁移到 CSS + 给卡片加玻璃效果

**Files:**
- Modify: `client/src/pages/complete/complete.css`
- Modify: `client/src/pages/complete/CompletePage.tsx`

- [ ] **Step 1: 替换 complete.css 完整内容**

```css
.complete {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-black);
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
  background: var(--color-surface-raised);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-modal);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
}

.complete-icon {
  margin-bottom: var(--space-2);
}

.complete-title {
  font-size: 28px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-white-85);
  line-height: 1.3;
  letter-spacing: var(--letter-spacing-tight);
}

.complete-desc {
  color: var(--color-white-50);
  font-size: 15px;
  line-height: 1.65;
}

.complete-sub {
  color: var(--color-white-40);
  font-size: 13px;
  margin-top: var(--space-2);
}
```

- [ ] **Step 2: 替换 CompletePage.tsx 完整内容**

```tsx
import './complete.css';

function CompletePage() {
  return (
    <div className="complete">
      <div className="complete-card">
        <div className="complete-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <path d="M14 20.5L18.5 25L26 17" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="complete-title">聊完啦，谢谢你！</h1>
        <p className="complete-desc">感谢你抽出时间分享使用体验，你的反馈对我们非常重要。每一条建议我们都会认真对待。</p>
        <p className="complete-sub">你可以关闭这个页面了</p>
      </div>
    </div>
  );
}

export default CompletePage;
```

- [ ] **Step 3: 类型检查**

```bash
cd D:/school-business/openinteraction/client && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/complete/
git commit -m "refactor(complete): migrate to CSS + add glass surface on card"
```

---

### Task 6：MessageList — 迁移到 className

**Files:**
- Modify: `client/src/components/message-list/MessageList.tsx`
- 已有：`client/src/components/message-list/message-list.css`（已写好，仅确认关键类存在）

- [ ] **Step 1: 替换 MessageList.tsx 完整内容**

```tsx
import { useEffect, useRef } from 'react';
import './message-list.css';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function MessageList({ messages, loading = false }: { messages: Message[]; loading?: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="msg-list">
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        return (
          <div key={i} className={`msg-row ${isUser ? 'msg-row--user' : 'msg-row--agent'}`}>
            {!isUser && <div className="msg-avatar msg-avatar--agent" aria-hidden="true" />}
            <div className={`msg-bubble ${isUser ? 'msg-bubble--user' : 'msg-bubble--agent'}`}>
              {msg.content}
            </div>
          </div>
        );
      })}
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

- [ ] **Step 2: 类型检查**

```bash
cd D:/school-business/openinteraction/client && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/message-list/
git commit -m "refactor(message-list): migrate to className + import CSS file"
```

---

### Task 7：MessageInput — 迁移到 className

**Files:**
- Modify: `client/src/components/message-input/MessageInput.tsx`
- 已有：`client/src/components/message-input/message-input.css`

- [ ] **Step 1: 替换 MessageInput.tsx 完整内容**

```tsx
import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react';
import './message-input.css';

function MessageInput({ onSend, disabled = false }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

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

  const handleInput = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <form className="msg-input-container" onSubmit={submit}>
      <div className="msg-input-frame">
        <div className="msg-input-inner">
          <textarea
            ref={taRef}
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

- [ ] **Step 2: 类型检查**

```bash
cd D:/school-business/openinteraction/client && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/message-input/
git commit -m "refactor(message-input): migrate to className + import CSS file"
```

---

### Task 8：提取 HomePage 到独立文件 + 删死代码 App.tsx

**Files:**
- Create: `client/src/pages/home/HomePage.tsx`
- Create: `client/src/pages/home/home.css`
- Modify: `client/src/router.tsx`
- Delete: `client/src/App.tsx`

router.tsx 里内联的 HomePage 需要剥离成独立文件，风格也补到玻璃卡片。同时 `App.tsx` 是孤儿文件（main.tsx 只 import router.tsx），删除。

- [ ] **Step 1: 创建 home.css**

```bash
mkdir -p D:/school-business/openinteraction/client/src/pages/home
```

写入 `client/src/pages/home/home.css`：

```css
.home {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-6);
  text-align: center;
  background: var(--color-black);
}

.home-card {
  max-width: 440px;
  width: 100%;
  padding: var(--space-12) var(--space-8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  background: var(--color-surface-raised);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-modal);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
}

.home-badge {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px var(--color-white-40);
  margin-bottom: var(--space-2);
}

.home-title {
  font-size: 28px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-white-85);
  line-height: 1.3;
  letter-spacing: var(--letter-spacing-tight);
}

.home-desc {
  color: var(--color-white-50);
  font-size: 15px;
  line-height: 1.65;
  max-width: 320px;
}

.home-hint {
  color: var(--color-white-40);
  font-size: 13px;
  margin-top: var(--space-2);
}
```

- [ ] **Step 2: 创建 HomePage.tsx**

写入 `client/src/pages/home/HomePage.tsx`：

```tsx
import './home.css';

function HomePage() {
  return (
    <div className="home">
      <div className="home-card">
        <div className="home-badge" aria-hidden="true" />
        <h1 className="home-title">产品体验访谈</h1>
        <p className="home-desc">通过自然对话收集用户反馈的 AI 访谈系统</p>
        <p className="home-hint">请使用访谈分享链接访问，或通过 API 创建新的访谈</p>
      </div>
    </div>
  );
}

export default HomePage;
```

- [ ] **Step 3: 替换 router.tsx（移除内联 HomePage）**

```tsx
import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/home/HomePage';
import LandingPage from './pages/landing/LandingPage';
import ChatPage from './pages/chat/ChatPage';
import CompletePage from './pages/complete/CompletePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/interview/:token',
    element: <LandingPage />,
  },
  {
    path: '/interview/:token/chat',
    element: <ChatPage />,
  },
  {
    path: '/interview/:token/complete',
    element: <CompletePage />,
  },
  {
    path: '*',
    element: <HomePage />,
  },
]);
```

- [ ] **Step 4: 删除 App.tsx**

```bash
rm D:/school-business/openinteraction/client/src/App.tsx
```

- [ ] **Step 5: 确认没有 import 引用 App.tsx**

```bash
cd D:/school-business/openinteraction/client/src && grep -rn "from './App'" --include="*.tsx" --include="*.ts" . 2>/dev/null
grep -rn "from \"./App\"" --include="*.tsx" --include="*.ts" . 2>/dev/null
```

预期：无输出（即无残留引用）。

- [ ] **Step 6: 类型检查**

```bash
cd D:/school-business/openinteraction/client && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
cd D:/school-business/openinteraction
git add client/src/pages/home/ client/src/router.tsx
git rm client/src/App.tsx
git commit -m "refactor(home): extract HomePage into dedicated module; drop unused App.tsx"
```

---

### Task 9：冒烟验证 — 启动 dev server 实测所有页面

**Files:** 无改动，仅运行验证。

这一步最关键 —— 因为 CSS refactor 没有单元测试，必须用 dev server 实跑验证 (1) 无白屏回归 (2) 样式确实应用 (3) 控制台无错。

- [ ] **Step 1: 启动 server（后端）**

```bash
cd D:/school-business/openinteraction/server && npm run dev
```

预期：控制台输出 "Server listening on :3001" 类似。保持运行（后台）。

- [ ] **Step 2: 启动 client（前端），另起一个终端**

```bash
cd D:/school-business/openinteraction/client && npm run dev
```

预期：控制台输出 "Local: http://localhost:5173"。

- [ ] **Step 3: 验证 HomePage（根路径）**

浏览器访问 `http://localhost:5173/`。

验证清单：
- [ ] 背景是纯黑 `#000`
- [ ] 中心有玻璃卡片（半透明灰背景 + 边缘 0.5px 白描边 + 有投影）
- [ ] 标题"产品体验访谈"为白色 28px 字重 600，字母间距略收窄
- [ ] 描述文字为 50% 白色透明度
- [ ] DevTools Console 无错

若白屏 ==> 打开 DevTools → Network → 检查 `home.css` 是否被请求；再到 Elements 面板看 `<style>` 标签是否包含 CSS 变量。

- [ ] **Step 4: 通过 API 创建一个访谈用于验证后续页面**

```bash
curl -X POST http://localhost:3001/api/interview/create \
  -H "Content-Type: application/json" \
  -d '{"project_name":"Variant 风格验证","project_description":"测试","topics":["视觉","交互"],"duration_minutes":10}'
```

预期：返回 `{"interview_id":"...", "token":"...", "share_url":"..."}`。**复制 token 值**。

- [ ] **Step 5: 验证 LandingPage**

浏览器访问 `http://localhost:5173/interview/<token>`。

验证清单：
- [ ] 玻璃卡片样式一致于 HomePage
- [ ] "开始聊天"按钮是**透明背景 + 0.5px 白描边**，而不是白实底
- [ ] hover 按钮：背景变为 `rgba(255,255,255,0.1)` 半透明填充，描边加粗
- [ ] 点击"开始聊天"跳转到 `/chat`

- [ ] **Step 6: 验证 ChatPage**

验证清单：
- [ ] 顶部 `chat-header` 有小圆点 + "产品体验访谈" 标签（灰色 13px）
- [ ] 消息列表居中 (max-width 640)，背景纯黑
- [ ] 发送一条消息，验证：
  - [ ] 用户气泡：白色 12% 透明背景，圆角 10px（右下 6px 尖角）
  - [ ] AI 气泡：`#1e1e1c` 深底，圆角 10px（左下 6px 尖角），带头像圆点
  - [ ] loading 时三点动画正常
- [ ] 底部输入框：`#1e1e1c` 背景 + 0.5px 描边 + 圆角 10px
- [ ] 发送按钮 hover 时背景变浅（`--color-white-07`）

- [ ] **Step 7: 验证 CompletePage**

在 chat 里触发 end_interview（Agent 会在合适时调用）；或直接访问 `http://localhost:5173/interview/<token>/complete`。

验证清单：
- [ ] 玻璃卡片风格一致
- [ ] 勾选 SVG 图标正确显示
- [ ] "聊完啦，谢谢你！" 标题字母间距收窄

- [ ] **Step 8: DevTools 全局检查**

打开 DevTools：
- [ ] Console：无 red error，无 CSS 相关 warning
- [ ] Network：`tokens.css`、`typography.css`、各页面 / 组件的 `.css` 都有 200 响应
- [ ] Elements：检查某个组件元素，右侧 Computed 面板显示颜色来自 `--color-white-85` 等变量（不是 hardcoded rgba）

- [ ] **Step 9: 关闭 dev server，commit**

```bash
# 如果前面验证过程修了 bug 才需要 commit；否则本步跳过
git status
```

如无变更则无需 commit。如发现 bug 并修复：

```bash
git add <fixed-files>
git commit -m "fix(<scope>): <describe-bug-and-fix>"
```

---

## Self-Review 清单

- ✅ **Spec 覆盖**：用户明确要求"全面对齐模板 + 统一回 CSS 文件 + tokens" —— 9 个 task 分别覆盖了 tokens 扩展、typography、3 个 pages、2 个 components、HomePage 抽离、验证
- ✅ **无占位符**：每个 step 都有完整的 CSS/TSX 代码块，无 "TBD" / "实现 X"
- ✅ **命名一致性**：`.landing-btn` / `.msg-input-submit` / `.chat-header-title` 等类名贯穿前后，不冲突
- ✅ **白屏根因处理**：每个组件/页面 .tsx 开头都显式 `import './xxx.css'`，避免 .css 再次变成死代码
- ✅ **按 commit 粒度切分**：每个 task 独立一个 commit，便于单独回滚

## 不在本计划内的事（YAGNI）

- 不引入 Tailwind
- 不做亮/暗双主题
- 不调整后端 server
- 不添加 Framer Motion 等动画库（variant.com 也纯 CSS）
- 不添加前端单元测试基础设施（当前项目无 client 端测试，视觉回归靠 dev server 人工验证足够）
