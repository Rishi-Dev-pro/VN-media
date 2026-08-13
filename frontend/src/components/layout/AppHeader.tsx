import { Bell, MessageCircle, Search } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { IconButton } from '../common/IconButton';
import type { View } from '../../types/navigation';
import { useNotificationsBadge } from '../../state/NotificationContext';
import './AppHeader.css';

interface AppHeaderProps {
  view: View;
  onNavigate: (view: View) => void;
}

export function AppHeader({ view, onNavigate }: AppHeaderProps) {
  const unread = useNotificationsBadge();
  return (
    <div className="app-header">
      <button
        type="button"
        className="brand"
        onClick={() => onNavigate('discover')}
        aria-label="VN-Media home — go to Discover"
      >
        <span className="brand__mark" aria-hidden="true">
          ✦
        </span>
        <span className="brand__name">VN-MEDIA</span>
      </button>

      <div className="app-header__actions">
        <IconButton
          label="Search"
          className="app-header__search"
          onClick={() => onNavigate('search')}
        >
          <Search />
        </IconButton>

        <IconButton
          label="Messages (2 unread)"
          className="app-header__message"
          onClick={() => onNavigate('messages')}
        >
          <MessageCircle />
          <span className="dot dot--pink" aria-hidden="true" />
        </IconButton>

        <IconButton
          label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
          onClick={() => onNavigate('notifications')}
          className="app-header__bell"
        >
          <Bell />
          {unread > 0 && (
            <span className="app-header__badge" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </IconButton>

        <button
          type="button"
          className={`app-header__me ${view === 'profile' ? 'is-active' : ''}`}
          onClick={() => onNavigate('profile')}
          aria-label="Your profile (1 notification)"
        >
          <Avatar src="/images/portrait-7.jpg" alt="You" size={34} />
          <span className="dot dot--pink" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
