import { Compass, Disc3, Mic2, Users } from 'lucide-react';
import type { NavItem, View } from '../../types/navigation';
import './TopNav.css';

const ITEMS: (NavItem & { icon: typeof Compass })[] = [
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'following', label: 'Following', icon: Users },
  { id: 'albums', label: 'Albums', icon: Disc3 },
  { id: 'creators', label: 'Creators', icon: Mic2 },
];

interface TopNavProps {
  active: View;
  onNavigate: (view: View) => void;
}

/** The floating pill navigation: Discover · Following · Albums · Creators */
export function TopNav({ active, onNavigate }: TopNavProps) {
  return (
    <nav className="topnav" aria-label="Primary">
      <div className="topnav__inner no-scrollbar" role="tablist">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`topnav__item ${isActive ? 'is-active' : ''}`}
              onClick={() => onNavigate(id)}
            >
              <Icon size={15} strokeWidth={2} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
