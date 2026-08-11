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
import LandingPage from './pages/landing/LandingPage';
import { FollowProvider } from './state/FollowContext';
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
const PLACEHOLDER_VIEWS: View[] = [
  'creators',
  'library',
  'messages',
  'notifications',
  'profile',
  'create',
];

export default function App() {
  return (
    <PlayerProvider>
      <FollowProvider>
        <ScrollToTop />
        <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<AppLayout />}>
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/following" element={<FollowingPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/albums" element={<AlbumsPage />} />
          <Route path="/albums/:id" element={<AlbumDetailPage />} />
          {PLACEHOLDER_VIEWS.map((v) => (
            <Route key={v} path={`/${v}`} element={<PlaceholderPage view={v} />} />
          ))}
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </FollowProvider>
    </PlayerProvider>
  );
}
