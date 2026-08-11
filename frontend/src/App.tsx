import { useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import DiscoverPage from './pages/DiscoverPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { PlayerProvider } from './state/PlayerContext';
import type { View } from './types/navigation';

export default function App() {
  const [view, setView] = useState<View>('discover');

  return (
    <PlayerProvider>
      <AppShell view={view} onNavigate={setView}>
        <div className="page-enter" key={view}>
          {view === 'discover' ? <DiscoverPage /> : <PlaceholderPage view={view} />}
        </div>
      </AppShell>
    </PlayerProvider>
  );
}
