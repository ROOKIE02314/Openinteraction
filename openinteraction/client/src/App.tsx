import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/landing/LandingPage';
import ChatPage from './pages/chat/ChatPage';
import CompletePage from './pages/complete/CompletePage';

function App() {
  return (
    <Routes>
      <Route path="/interview/:token" element={<LandingPage />} />
      <Route path="/interview/:token/chat" element={<ChatPage />} />
      <Route path="/interview/:token/complete" element={<CompletePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
