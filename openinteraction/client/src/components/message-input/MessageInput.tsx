import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react';

const S = {
  container: { padding: '12px 16px', paddingTop: 0 },
  frame: {
    borderRadius: 10,
    boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.1)',
    background: '#1e1e1c',
  },
  inner: {
    display: 'flex', alignItems: 'flex-end' as const,
    gap: 8, padding: '8px 8px 8px 12px',
  },
  field: {
    flex: 1, background: 'transparent', border: 'none',
    color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter, sans-serif',
    fontSize: 14, lineHeight: 1.55, resize: 'none' as const,
    outline: 'none', minHeight: 24, maxHeight: 160,
    overflowY: 'auto' as const,
  },
  btn: {
    width: 32, height: 32, border: 'none', borderRadius: 6,
    background: 'transparent', color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
};

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
    <form style={S.container} onSubmit={submit}>
      <div style={S.frame}>
        <div style={S.inner}>
          <textarea
            ref={taRef}
            style={S.field}
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
            style={{
              ...S.btn,
              opacity: disabled || !text.trim() ? 0.3 : 1,
            }}
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
