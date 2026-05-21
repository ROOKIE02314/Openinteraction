import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent, useEffect } from 'react';
import './message-input.css';

/* ------------------------------------------------------------------ */
/*  Web Speech API type augmentation (not in default TS lib)          */
/* ------------------------------------------------------------------ */
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  value?: string;
  onValueChange?: (next: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
function MessageInput({ onSend, disabled = false, value, onValueChange }: MessageInputProps) {
  /* ---- controlled / uncontrolled ---- */
  const isControlled = value !== undefined && onValueChange !== undefined;
  const [internal, setInternal] = useState('');
  const text = isControlled ? (value as string) : internal;
  const setText = useCallback(
    (next: string) => {
      if (isControlled) onValueChange!(next);
      else setInternal(next);
    },
    [isControlled, onValueChange],
  );

  /* ---- refs & speech state ---- */
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef('');
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SpeechRecognitionCtor = useRef(getSpeechRecognition()).current;
  const sttSupported = SpeechRecognitionCtor !== null;

  /* ---- auto-resize textarea ---- */
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text, interimText]);

  /* ---- display value (base + interim) ---- */
  const displayValue = isRecording && interimText ? text + interimText : text;
  const textareaClassName = isRecording && interimText
    ? 'msg-input-field msg-input-field--interim'
    : 'msg-input-field';

  /* ---- submit ---- */
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
    baseTextRef.current = '';
    if (taRef.current) taRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  /* ---- textarea change handler ---- */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (isRecording) {
      // User edited during recording: clear interim, update base
      setInterimText('');
      baseTextRef.current = newValue;
    }
    setText(newValue);
  };

  /* ---- recording timer ---- */
  useEffect(() => {
    if (isRecording) {
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setRecordSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  /* ---- stop recording helper ---- */
  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  /* ---- toggle mic ---- */
  const toggleMic = useCallback(() => {
    if (!SpeechRecognitionCtor) return;

    if (isRecording) {
      stopRecording();
      return;
    }

    // Start recording
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    baseTextRef.current = text;
    setInterimText('');

    recognition.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const transcript = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) {
          baseTextRef.current += transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
      setText(baseTextRef.current);
    };

    recognition.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === 'not-allowed') {
        alert('请允许麦克风权限后重试。您可以在浏览器地址栏左侧的设置中开启。');
      }
      stopRecording();
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText('');
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch {
      // Already started or other error
      setIsRecording(false);
    }
  }, [isRecording, text, setText, stopRecording, SpeechRecognitionCtor]);

  /* ---- cleanup on unmount ---- */
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /* ---- render ---- */
  return (
    <form className="msg-input-container" onSubmit={submit}>
      <div className="msg-input-frame">
        <div className="msg-input-inner">
          <textarea
            ref={taRef}
            className={textareaClassName}
            value={displayValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="说说你的想法..."
            disabled={disabled}
            rows={1}
          />

          {sttSupported && (
            <button
              type="button"
              className={`msg-input-mic${isRecording ? ' msg-input-mic--active' : ''}`}
              onClick={toggleMic}
              disabled={disabled}
              aria-label={isRecording ? '停止录音' : '开始录音'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {isRecording && (
            <span className="msg-input-mic-time">{formatTime(recordSeconds)}</span>
          )}

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
