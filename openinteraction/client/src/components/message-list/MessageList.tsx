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
