import { Routes, Route } from 'react-router-dom';
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
    }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 40, lineHeight: 1, userSelect: 'none' }}>,</p>
      <h1>产品体验访谈</h1>
      <p>通过自然对话收集用户反馈的 AI 访谈系统</p>
      <p className="text-muted" style={{ marginTop: 8 }}>
        请使用访谈分享链接访问，或通过 API 创建新的访谈
      </p>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/interview/:token" element={<LandingPage />} />
      <Route path="/interview/:token/chat" element={<ChatPage />} />
      <Route path="/interview/:token/complete" element={<CompletePage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}

export default App;
