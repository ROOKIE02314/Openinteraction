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

function MessageList({
  messages,
  loading = false,
  streamingContent,
  isPlaying = false,
  onReplay,
  onStopAudio,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, streamingContent]);

  return (
    <div className="msg-list">
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        const hasAudio = !isUser && msg.audioChunks && msg.audioChunks.length > 0;
        return (
          <div key={i} className={`msg-row ${isUser ? 'msg-row--user' : 'msg-row--agent'}`}>
            {!isUser && <div className="msg-avatar msg-avatar--agent" aria-hidden="true" />}
            <div className={`msg-bubble ${isUser ? 'msg-bubble--user' : 'msg-bubble--agent'}`}>
              {msg.content}
              {hasAudio && (
                <div className="msg-audio-controls">
                  {isPlaying ? (
                    <button
                      className="msg-audio-btn"
                      onClick={onStopAudio}
                      aria-label="Stop audio"
                      title="Stop"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                        <rect x="2" y="1" width="3.5" height="12" rx="1" />
                        <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      className="msg-audio-btn"
                      onClick={() => onReplay?.(msg.audioChunks!)}
                      aria-label="Replay audio"
                      title="Replay"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 4v6h6" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
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
