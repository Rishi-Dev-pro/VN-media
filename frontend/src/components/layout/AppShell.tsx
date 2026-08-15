import { useState, type ReactNode } from 'react';
import type { View } from '../../types/navigation';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { usePlaybackHistory } from '../../hooks/usePlaybackHistory';
import { DesktopSideNav } from './DesktopSideNav';
import { MobileBottomNav } from './MobileBottomNav';
import { AppHeader } from './AppHeader';
import { MiniPlayer } from './MiniPlayer';
import { PlayerSheet } from './PlayerSheet';
import { TopNav } from '../navigation/TopNav';
import './AppShell.css';

interface AppShellProps {
  view: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
}

function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <span className="bg-streak" />
      <svg className="bg-noise" xmlns="http://www.w3.org/2000/svg">
        <filter id="vn-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#vn-noise)" opacity="0.5" />
      </svg>
      <span className="bg-vignette" />
    </div>
  );
}

export function AppShell({ view, onNavigate, children }: AppShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // global listening companion: every play flows into recently-played,
  // and the transport answers to keyboard shortcuts (never while typing)
  usePlaybackHistory();
  useKeyboardShortcuts();

  return (
    <div className="shell">
      <Background />
      <DesktopSideNav active={view} onNavigate={onNavigate} />

      <div className="shell-wrap">
        <div className="app-frame">
          <header className="app-frame__header">
            <AppHeader view={view} onNavigate={onNavigate} />
            <TopNav active={view} onNavigate={onNavigate} />
          </header>
          <main className="app-frame__main">{children}</main>
        </div>
      </div>

      <MobileBottomNav active={view} onNavigate={onNavigate} />
      <MiniPlayer onExpand={() => setSheetOpen(true)} />
      <PlayerSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
