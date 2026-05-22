import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getInterview, sendMessage, sendMessageStream } from '../../api/client';
import type { Interview, SSEEvent } from '../../api/client';
import MessageList from '../../components/message-list/MessageList';
import MessageInput from '../../components/message-input/MessageInput';
import AudioPlayer from '../../components/audio-player/AudioPlayer';
import type { AudioPlayerHandle } from '../../components/audio-player/AudioPlayer';
import AvatarPanel from '../../components/agent-avatar/AvatarPanel';
import type { EmotionState } from '../../components/agent-avatar/AgentAvatar';
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
  const [streamingContent, setStreamingContent] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [agentEmotion, setAgentEmotion] = useState<EmotionState>('idle');

  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const abortRef = useRef<AbortController | null>(null);
  const currentAudioChunksRef = useRef<string[]>([]);
  const streamedTextRef = useRef('');

  useEffect(() => {
    if (!interview && token) {
      getInterview(token).then(setInterview).catch(() => navigate(`/interview/${token}`));
    }
  }, [token, interview, navigate]);

  // Abort any in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleStopAudio = () => {
    audioPlayerRef.current?.stop();
    setIsPlaying(false);
  };

  const handleReplay = (audioChunks: string[]) => {
    audioPlayerRef.current?.replay(audioChunks);
    setIsPlaying(true);
  };

  const handleSend = async (text: string) => {
    if (!interview) return;

    // Abort any previous in-flight stream
    abortRef.current?.abort();

    const userMessage: Message = { role: 'user' as const, content: text };
    const updated: Message[] = [...messages, userMessage];
    setMessages(updated);
    setLoading(true);
    setError(null);
    setStreamingContent('');
    streamedTextRef.current = '';
    currentAudioChunksRef.current = [];
    setAgentEmotion('listening');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await sendMessageStream(
        interview.interview_id,
        text,
        (event: SSEEvent) => {
          switch (event.type) {
            case 'text':
              streamedTextRef.current += event.chunk || '';
              setStreamingContent(streamedTextRef.current);
              break;
            case 'audio':
              if (event.chunk) {
                currentAudioChunksRef.current.push(event.chunk);
                audioPlayerRef.current?.enqueueChunk(event.chunk);
                setIsPlaying(true);
              }
              break;
            case 'emotion':
              setAgentEmotion(event.state as EmotionState);
              break;
            case 'done': {
              const finalText = streamedTextRef.current;
              if (finalText) {
                setMessages((msgs) => [
                  ...msgs,
                  {
                    role: 'assistant' as const,
                    content: finalText,
                    audioChunks: [...currentAudioChunksRef.current],
                  },
                ]);
              }
              setStreamingContent('');
              streamedTextRef.current = '';
              if (event.interview_status === 'completed') {
                setTimeout(
                  () => navigate(`/interview/${token}/complete`, { state: { interview } }),
                  2000,
                );
              }
              break;
            }
            case 'error':
              setError(event.message || '流式传输出错，请重试');
              setStreamingContent('');
              setAgentEmotion('idle');
              break;
          }
        },
        controller.signal,
      );
    } catch (err: unknown) {
      setError(`SSE错误: ${err instanceof Error ? err.message : String(err)}`);
      // If aborted, don't fall back
      if (controller.signal.aborted) return;

      // Fall back to non-streaming sendMessage
      try {
        const result = await sendMessage(interview.interview_id, text);
        setMessages((msgs) => [
          ...msgs,
          { role: 'assistant' as const, content: result.response },
        ]);
        setAgentEmotion('idle');
        if (result.interview_status === 'completed') {
          setTimeout(
            () => navigate(`/interview/${token}/complete`, { state: { interview } }),
            2000,
          );
        }
      } catch (fallbackErr: unknown) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : '发送失败，请重试');
      }
      setStreamingContent('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat">
      <AvatarPanel emotion={agentEmotion} />
      <div className="chat-main">
        <div className="chat-header">
          <span className="chat-header-dot" />
          <span className="chat-header-title">产品体验访谈</span>
        </div>
        <MessageList
          messages={messages}
          loading={loading}
          streamingContent={streamingContent}
          isPlaying={isPlaying}
          onReplay={handleReplay}
          onStopAudio={handleStopAudio}
        />
        {error && <div className="chat-error" role="alert">{error}</div>}
        <MessageInput onSend={handleSend} disabled={loading} />
        <AudioPlayer ref={audioPlayerRef} />
      </div>
    </div>
  );
}

export default ChatPage;
