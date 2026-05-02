import { createBrowserRouter } from 'react-router-dom';
import LandingPage from './pages/landing/LandingPage';
import ChatPage from './pages/chat/ChatPage';
import CompletePage from './pages/complete/CompletePage';

function HomePage() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 24,
      textAlign: 'center',
      background: '#000',
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.6)',
        marginBottom: 8,
      }} />
      <h1 style={{
        fontSize: 28,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.85)',
      }}>产品体验访谈</h1>
      <p style={{
        color: 'rgba(255,255,255,0.5)',
        fontSize: 15,
        lineHeight: 1.65,
      }}>通过自然对话收集用户反馈的 AI 访谈系统</p>
      <p style={{
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        marginTop: 8,
      }}>
        请使用访谈分享链接访问，或通过 API 创建新的访谈
      </p>
    </div>
  );
}

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
