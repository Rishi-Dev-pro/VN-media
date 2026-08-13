import {
  Bell,
  Compass,
  Home,
  Library,
  MessageCircle,
  PlusCircle,
  Search,
  User,
} from 'lucide-react';
import type { View } from '../../types/navigation';
import { useNotificationsBadge } from '../../state/NotificationContext';
import './MobileBottomNav.css';

const ITEMS: { id: View; label: string; icon: typeof Home; notify?: boolean; badge?: boolean }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'messages', label: 'Messages', icon: MessageCircle, notify: true },
  { id: 'notifications', label: 'Notifications', icon: Bell, badge: true },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'create', label: 'Create', icon: PlusCircle },
  { id: 'profile', label: 'Profile', icon: User, notify: true },
];

interface MobileBottomNavProps {
  active: View;
  onNavigate: (view: View) => void;
}

export function MobileBottomNav({ active, onNavigate }: MobileBottomNavProps) {
  const unread = useNotificationsBadge();

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav__inner">
        {ITEMS.map(({ id, label, icon: Icon, notify, badge }) => {
          const isActive = active === id;
          const count = badge ? unread : 0;
          return (
            <button
              key={id}
              type="button"
              className={`bottom-nav__item ${isActive ? 'is-active' : ''}`}
              onClick={() => onNavigate(id)}
              aria-label={count > 0 ? `${label} (${count} unread)` : label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="bottom-nav__icon">
                <Icon size={21} strokeWidth={isActive ? 2.2 : 1.9} aria-hidden="true" />
                {notify && <span className="bottom-nav__ping" aria-hidden="true" />}
                {badge && count > 0 && (
                  <span className="bottom-nav__badge" aria-hidden="true">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </span>
              <span className="bottom-nav__label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
