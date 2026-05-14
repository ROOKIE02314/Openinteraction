import { useState, useRef, type FormEvent, type KeyboardEvent, useEffect } from 'react';
import './message-input.css';

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  value?: string;
  onValueChange?: (next: string) => void;
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

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

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
