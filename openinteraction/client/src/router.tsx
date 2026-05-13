import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/home/HomePage';
import LandingPage from './pages/landing/LandingPage';
import ChatPage from './pages/chat/ChatPage';
import CompletePage from './pages/complete/CompletePage';

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
