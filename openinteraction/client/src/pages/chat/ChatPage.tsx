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
