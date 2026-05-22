import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/home/HomePage';
import LandingPage from './pages/landing/LandingPage';
import ChatPage from './pages/chat/ChatPage';
import CompletePage from './pages/complete/CompletePage';
import AnalyticsOverview from './pages/dashboard/AnalyticsOverview';
import ProjectsList from './pages/dashboard/ProjectsList';
import ProjectDetail from './pages/dashboard/ProjectDetail';
import CreateProject from './pages/dashboard/CreateProject';

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
    path: '/dashboard',
    element: <AnalyticsOverview />,
  },
  {
    path: '/dashboard/projects',
    element: <ProjectsList />,
  },
  {
    path: '/dashboard/create',
    element: <CreateProject />,
  },
  {
    path: '/dashboard/projects/:id',
    element: <ProjectDetail />,
  },
  {
    path: '*',
    element: <HomePage />,
  },
]);
