import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import DiscoverPage from './pages/DiscoverPage';
import PlaceholderPage from './pages/PlaceholderPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FollowingPage from './pages/FollowingPage';
import SearchPage from './pages/SearchPage';
import AlbumsPage from './pages/AlbumsPage';
import AlbumDetailPage from './pages/AlbumDetailPage';
import CreatorsPage from './pages/CreatorsPage';
import CreatorProfilePage from './pages/CreatorProfilePage';
import LibraryPage from './pages/LibraryPage';
import MessagesPage from './pages/MessagesPage';
import ConversationPage from './pages/ConversationPage';
import NotificationsPage from './pages/NotificationsPage';
import UserProfilePage from './pages/UserProfilePage';
import LandingPage from './pages/landing/LandingPage';
import { FollowProvider } from './state/FollowContext';
import { NotificationProvider } from './state/NotificationContext';
import { PlayerProvider } from './state/PlayerContext';
import type { View } from './types/navigation';

/** Reset scroll on route changes (the landing page is long). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** App views that render elegant placeholders until their phase lands. */
const PLACEHOLDER_VIEWS: View[] = ['create'];

export default function App() {
  return (
    <PlayerProvider>
      <FollowProvider>
        <NotificationProvider>
        <ScrollToTop />
        <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<AppLayout />}>
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/following" element={<FollowingPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/albums" element={<AlbumsPage />} />
          <Route path="/albums/:id" element={<AlbumDetailPage />} />
          <Route path="/creators" element={<CreatorsPage />} />
          <Route path="/creators/:username" element={<CreatorProfilePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:conversationId" element={<ConversationPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<UserProfilePage />} />
          {PLACEHOLDER_VIEWS.map((v) => (
            <Route key={v} path={`/${v}`} element={<PlaceholderPage view={v} />} />
          ))}
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </NotificationProvider>
      </FollowProvider>
    </PlayerProvider>
  );
}
