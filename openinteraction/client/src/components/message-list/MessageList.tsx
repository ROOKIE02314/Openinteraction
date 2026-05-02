import { useEffect, useRef } from 'react';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const S = {
  list: {
    flex: 1, overflowY: 'auto' as const, padding: 16,
    display: 'flex', flexDirection: 'column' as const, gap: 12,
  },
  rowBase: {
    display: 'flex', gap: 8, maxWidth: '85%',
  },
  rowAgent: {
    alignSelf: 'flex-start' as const,
  },
  rowUser: {
    alignSelf: 'flex-end' as const, flexDirection: 'row-reverse' as const,
  },
  avatar: {
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    background: 'rgba(255,255,255,0.08)',
    boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.1)',
  },
  bubbleBase: {
    padding: '10px 14px', fontSize: 14, lineHeight: 1.55,
    maxWidth: '100%', wordBreak: 'break-word' as const,
    overflowWrap: 'break-word' as const, whiteSpace: 'pre-wrap' as const,
  },
  bubbleAgent: {
    background: '#1e1e1c', borderRadius: '10px 10px 10px 6px',
    color: 'rgba(255,255,255,0.85)',
    boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.1)',
  },
  bubbleUser: {
    background: 'rgba(255,255,255,0.12)',
    borderRadius: '10px 10px 6px 10px',
    color: 'rgba(255,255,255,0.85)',
    boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.1)',
  },
  empty: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  loadingBubble: {
    display: 'flex', gap: 4, alignItems: 'center', padding: '14px 18px',
  },
  dot: {
    width: 5, height: 5, borderRadius: '50%',
    background: 'rgba(255,255,255,0.4)',
    animation: 'msgDot 1.4s ease-in-out infinite',
  },
};

function MessageList({ messages, loading = false }: { messages: Message[]; loading?: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div style={S.list}>
      <style>{'@keyframes msgDot{0%,80%,100%{opacity:0.2;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}}'}</style>
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        return (
          <div key={i} style={{ ...S.rowBase, ...(isUser ? S.rowUser : S.rowAgent) }}>
            {!isUser && <div style={S.avatar} aria-hidden="true" />}
            <div style={{
              ...S.bubbleBase,
              ...(isUser ? S.bubbleUser : S.bubbleAgent),
            }}>
              {msg.content}
            </div>
          </div>
        );
      })}
      {loading && (
        <div style={{ ...S.rowBase, ...S.rowAgent }}>
          <div style={S.avatar} aria-hidden="true" />
          <div style={{ ...S.bubbleBase, ...S.bubbleAgent, ...S.loadingBubble }}>
            <span style={S.dot} />
            <span style={{ ...S.dot, animationDelay: '0.2s' }} />
            <span style={{ ...S.dot, animationDelay: '0.4s' }} />
          </div>
        </div>
      )}
      {messages.length === 0 && !loading && (
        <div style={S.empty}>
          <p style={S.emptyText}>开始对话吧</p>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export default MessageList;
