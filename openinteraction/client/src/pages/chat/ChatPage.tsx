import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getInterview, sendMessage } from '../../api/client';
import type { Interview } from '../../api/client';
import MessageList from '../../components/message-list/MessageList';
import MessageInput from '../../components/message-input/MessageInput';
import type { Message } from '../../components/message-list/MessageList';

const S = {
  chat: {
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#000',
    maxWidth: 640,
    margin: '0 auto',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '0.5px solid rgba(255,255,255,0.08)',
  },
  dot: {
    width: 7, height: 7, borderRadius: '50%',
    background: 'rgba(255,255,255,0.3)',
  },
  headerTitle: {
    fontSize: 13, fontWeight: 500,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.01em',
  },
  error: {
    padding: '6px 16px', textAlign: 'center' as const,
    color: 'rgba(255,100,100,0.8)', fontSize: 13,
    background: 'rgba(255,60,60,0.08)',
    borderTop: '0.5px solid rgba(255,60,60,0.15)',
  },
};

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
    <div style={S.chat}>
      <div style={S.header}>
        <span style={S.dot} />
        <span style={S.headerTitle}>产品体验访谈</span>
      </div>
      <MessageList messages={messages} loading={loading} />
      {error && <div style={S.error} role="alert">{error}</div>}
      <MessageInput onSend={handleSend} disabled={loading} />
    </div>
  );
}

export default ChatPage;
