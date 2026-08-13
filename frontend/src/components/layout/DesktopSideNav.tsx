import {
  Bell,
  Compass,
  Home,
  Library,
  MessageCircle,
  Search,
  User,
} from 'lucide-react';
import type { View } from '../../types/navigation';
import { useNotificationsBadge } from '../../state/NotificationContext';
import './DesktopSideNav.css';

const ITEMS: { id: View; label: string; icon: typeof Home; notify?: boolean; badge?: boolean }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'messages', label: 'Messages', icon: MessageCircle, notify: true },
  { id: 'notifications', label: 'Notifications', icon: Bell, badge: true },
  { id: 'profile', label: 'Profile', icon: User, notify: true },
];

interface DesktopSideNavProps {
  active: View;
  onNavigate: (view: View) => void;
}

/** Minimal floating rail shown on desktop only. */
export function DesktopSideNav({ active, onNavigate }: DesktopSideNavProps) {
  const unread = useNotificationsBadge();

  return (
    <nav className="side-rail" aria-label="Application">
      {ITEMS.map(({ id, label, icon: Icon, notify, badge }) => {
        const isActive = active === id;
        const count = badge ? unread : 0;
        return (
          <button
            key={id}
            type="button"
            className={`side-rail__item ${isActive ? 'is-active' : ''}`}
            onClick={() => onNavigate(id)}
            aria-label={count > 0 ? `${label} (${count} unread)` : label}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="side-rail__dot">
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
              {notify && <span className="side-rail__ping" aria-hidden="true" />}
              {badge && count > 0 && (
                <span className="side-rail__badge" aria-hidden="true">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </span>
            <span className="side-rail__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
