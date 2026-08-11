import {
  Compass,
  Home,
  Library,
  MessageCircle,
  User,
} from 'lucide-react';
import type { View } from '../../types/navigation';
import './DesktopSideNav.css';

const ITEMS: { id: View; label: string; icon: typeof Home; notify?: boolean }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'messages', label: 'Messages', icon: MessageCircle, notify: true },
  { id: 'profile', label: 'Profile', icon: User, notify: true },
];

interface DesktopSideNavProps {
  active: View;
  onNavigate: (view: View) => void;
}

/** Minimal floating rail shown on desktop only. */
export function DesktopSideNav({ active, onNavigate }: DesktopSideNavProps) {
  return (
    <nav className="side-rail" aria-label="Application">
      {ITEMS.map(({ id, label, icon: Icon, notify }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            className={`side-rail__item ${isActive ? 'is-active' : ''}`}
            onClick={() => onNavigate(id)}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="side-rail__dot">
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
              {notify && <span className="side-rail__ping" aria-hidden="true" />}
            </span>
            <span className="side-rail__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
