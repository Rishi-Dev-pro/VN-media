import {
  Compass,
  Home,
  PlusCircle,
  Search,
  User,
} from 'lucide-react';
import type { View } from '../../types/navigation';
import './MobileBottomNav.css';

const ITEMS: { id: View; label: string; icon: typeof Home; notify?: boolean }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'create', label: 'Create', icon: PlusCircle },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'profile', label: 'Profile', icon: User, notify: true },
];

interface MobileBottomNavProps {
  active: View;
  onNavigate: (view: View) => void;
}

export function MobileBottomNav({ active, onNavigate }: MobileBottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav__inner">
        {ITEMS.map(({ id, label, icon: Icon, notify }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              className={`bottom-nav__item ${isActive ? 'is-active' : ''}`}
              onClick={() => onNavigate(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="bottom-nav__icon">
                <Icon size={21} strokeWidth={isActive ? 2.2 : 1.9} aria-hidden="true" />
                {notify && <span className="bottom-nav__ping" aria-hidden="true" />}
              </span>
              <span className="bottom-nav__label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
