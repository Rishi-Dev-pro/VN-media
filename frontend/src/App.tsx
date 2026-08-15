import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import DiscoverPage from './pages/DiscoverPage';
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
import CreatorStudioPage from './pages/CreatorStudioPage';
import LandingPage from './pages/landing/LandingPage';
import { FollowProvider } from './state/FollowContext';
import { NotificationProvider } from './state/NotificationContext';
import { PlayerProvider } from './state/PlayerContext';
import { SessionProvider, useSession } from './state/SessionContext';
import { isApiMode } from './services/api/apiConfig';
import { Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';

/** API-mode auth guard — protected routes redirect to /login when the
 *  session is missing/expired. Mock mode never gates. */
function RequireAuth({ children }: { children: ReactNode }) {
  const status = useSession();
  if (!isApiMode) return <>{children}</>;
  if (status === 'loading') {
    return (
      <div
        className="auth-gate"
        role="status"
        aria-label="Checking your session"
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '40vh',
        }}
      >
        <span className="spinner" aria-hidden="true" />
      </div>
    );
  }
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Reset scroll on route changes (the landing page is long). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <SessionProvider>
    <PlayerProvider>
      <FollowProvider>
        <NotificationProvider>
        <ScrollToTop />
        <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<AppLayout />}>
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/albums" element={<AlbumsPage />} />
          <Route path="/albums/:id" element={<AlbumDetailPage />} />
          <Route path="/creators" element={<CreatorsPage />} />
          <Route path="/creators/:username" element={<CreatorProfilePage />} />

          <Route
            element={
              <RequireAuth>
                <Outlet />
              </RequireAuth>
            }
          >
            <Route path="/following" element={<FollowingPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<ConversationPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<UserProfilePage />} />
            <Route path="/create" element={<CreatorStudioPage />} />
          </Route>
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </NotificationProvider>
      </FollowProvider>
    </PlayerProvider>
    </SessionProvider>
  );
}
