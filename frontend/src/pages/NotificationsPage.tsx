import { BellOff, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { NotificationCard } from '../components/notifications/NotificationCard';
import { NotificationPreferences } from '../components/notifications/NotificationPreferences';
import { EmptyState } from '../components/common/EmptyState';
import { getCreator } from '../data/mockCreators';
import { voiceNotesById } from '../data/mockVoiceNotes';
import type { AppNotification } from '../data/notifications';
import { DEMO_NOW } from '../data/mockFollowing';
import { useNotifications } from '../hooks/useNotifications';
import { usePlayer } from '../state/PlayerContext';
import { formatReleaseDate } from '../utils/format';
import './NotificationsPage.css';

type Filter = 'all' | 'unread';

const INITIAL_VISIBLE = 12;

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date(DEMO_NOW);
  const y = new Date(DEMO_NOW - 86400000);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'TODAY';
  if (same(d, y)) return 'YESTERDAY';
  return formatReleaseDate(new Date(ts).toISOString()).toUpperCase();
}

export default function NotificationsPage() {
  const {
    notifications,
    loading,
    error,
    retry,
    unreadCount,
    markRead,
    markAllRead,
    preferences,
    togglePreference,
  } = useNotifications();
  const navigate = useNavigate();
  const { play } = usePlayer();

  const [params, setParams] = useSearchParams();
  const filter: Filter = params.get('filter') === 'unread' ? 'unread' : 'all';
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [filter]);

  const setFilter = useCallback(
    (next: Filter) => {
      setParams(next === 'unread' ? { filter: 'unread' } : {}, { replace: true });
    },
    [setParams],
  );

  const filtered = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => n.readAt === null) : notifications),
    [notifications, filter],
  );

  const sliced = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const groups = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    sliced.forEach((n) => {
      const key = dayLabel(n.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    });
    return Array.from(map.entries());
  }, [sliced]);

  const open = useCallback(
    (n: AppNotification) => {
      markRead(n.id);
      if (n.type === 'USER_FOLLOWED') {
        const creator = getCreator(n.actorId);
        navigate(`/creators/${creator.handle}`);
        return;
      }
      if (n.type === 'MESSAGE_RECEIVED' && n.conversationId) {
        navigate(`/messages/${n.conversationId}`);
        return;
      }
      // like / comment → play through the global player, land on Discover
      if (n.voiceNoteId) {
        const note = voiceNotesById[n.voiceNoteId];
        if (note) play(note, [note]);
      }
      navigate('/discover');
    },
    [markRead, navigate, play],
  );

  const handleMarkAll = useCallback(() => {
    if (unreadCount === 0) return;
    markAllRead();
    showToast('ALL CAUGHT UP');
  }, [unreadCount, markAllRead, showToast]);

  const empty =
    !loading && !error && filtered.length === 0;

  return (
    <div className="notifications-page">
      <header className="notif-head">
        <div>
          <span className="notif-head__eyebrow micro">Your signal</span>
          <h1 className="notif-head__title">NOTIFICATIONS.</h1>
          <p className="notif-head__ghost text-ghost">
            WHAT HAPPENED
            <br />
            WHILE YOU WERE AWAY.
          </p>
          <p className="notif-head__sub">A quiet record of the people who found your voice.</p>
        </div>
        <span className="notif-head__badge">
          <span className="notif-head__badge-dot" aria-hidden="true" />
          YOUR SIGNAL
          {unreadCount > 0 && (
            <span className="notif-head__unread tabular" aria-label={`${unreadCount} unread`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      </header>

      <div className="notif-controls">
        <div className="notif-tabs" role="tablist" aria-label="Notification filter">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`notif-tabs__item ${filter === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'unread'}
            className={`notif-tabs__item ${filter === 'unread' ? 'is-active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread
            {unreadCount > 0 && <span className="notif-tabs__count tabular">{unreadCount}</span>}
          </button>
        </div>

        <button
          type="button"
          className="notif-markall"
          onClick={handleMarkAll}
          disabled={unreadCount === 0}
        >
          <CheckCheck size={14} aria-hidden="true" />
          MARK ALL AS READ
        </button>
      </div>

      {/* ---------- loading ---------- */}
      {loading && (
        <div className="notif-skeleton" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="notif-sk">
              <span className="skeleton notif-sk__icon" />
              <span className="skeleton notif-sk__avatar" />
              <span className="notif-sk__lines">
                <span className="skeleton notif-sk__line" style={{ width: `${52 + ((i * 11) % 34)}%` }} />
                <span className="skeleton notif-sk__line" style={{ width: '30%' }} />
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ---------- error ---------- */}
      {!loading && error && (
        <EmptyState
          icon={<span className="notif-page__orb" aria-hidden="true">✕</span>}
          title="NOTIFICATIONS LOST THE SIGNAL."
          body="Something interrupted your notification stream."
          action={
            <button type="button" className="btn btn--primary" onClick={retry}>
              TRY AGAIN
            </button>
          }
        />
      )}

      {/* ---------- empty ---------- */}
      {empty && (
        <EmptyState
          icon={<BellOff size={26} />}
          title={filter === 'unread' ? 'NO UNREAD NOTIFICATIONS.' : "YOU'RE ALL CAUGHT UP."}
          body={filter === 'unread' ? 'Your signal is quiet for now.' : 'Nothing new has happened here.'}
          action={
            <Link to="/discover" className="btn btn--primary">
              EXPLORE DISCOVER
            </Link>
          }
        />
      )}

      {/* ---------- feed ---------- */}
      {!loading && !error && !empty && (
        <div className="notif-feed">
          {groups.map(([day, items]) => (
            <section key={day} className="notif-group">
              <h2 className="notif-group__day micro">{day}</h2>
              <div className="notif-group__list">
                {items.map((n, i) => (
                  <NotificationCard key={n.id} notification={n} index={i} onOpen={open} />
                ))}
              </div>
            </section>
          ))}

          {sliced.length < filtered.length && (
            <div className="notif-more">
              <span className="notif-more__count tabular">
                SHOWING {sliced.length} OF {filtered.length}
              </span>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setVisibleCount((c) => c + 10)}
              >
                LOAD MORE
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------- preferences ---------- */}
      {!loading && !error && (
        <NotificationPreferences preferences={preferences} onToggle={togglePreference} />
      )}

      {/* ---------- toast ---------- */}
      {toast && (
        <div className="notif-toast-banner" role="status" aria-live="polite">
          <span className="notif-toast-banner__dot" aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}
