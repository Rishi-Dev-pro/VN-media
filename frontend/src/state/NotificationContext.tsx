import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppNotification } from '../data/notifications';
import { createNotificationRepository } from '../services/notificationRepository';
import { createVoiceNoteRepository } from '../services/voiceNoteRepository';
import { NotificationToast } from '../components/notifications/NotificationToast';
import {
  resolveCreatorSync,
  resolveNoteSync,
} from '../services/api/identity';
import { usePlayer } from './PlayerContext';
import { useSession } from './SessionContext';
import { isApiMode } from '../services/api/apiConfig';

/* ============================================================
   Global notification state.

   One place that knows the unread count (nav badges) and turns
   freshly-arriving mock notifications into the floating toast.
   The repository is the source of truth; this context only
   mirrors what it needs for chrome + toasts. No backend.
   ============================================================ */

const repo = createNotificationRepository();

interface NotificationContextValue {
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextValue>({ unreadCount: 0 });

const AUTH_ROUTES = ['/login', '/register'];

export function NotificationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { play } = usePlayer();
  const sessionStatus = useSession();

  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const toastTimer = useRef<number | null>(null);
  const mounted = useRef(true);

  // API mode: only fetch + subscribe when authenticated. The provider
  // outlives login (it wraps the whole tree), so an unauthenticated
  // mount must not fire protected requests (401 race) or attach the
  // socket before a token exists. Mock mode keeps its simulation.
  useEffect(() => {
    if (isApiMode && sessionStatus !== 'authenticated') {
      if (sessionStatus === 'unauthenticated') {
        knownIds.current.clear();
        setUnreadCount(0);
      }
      return;
    }

    mounted.current = true;
    const refresh = async () => {
      try {
        const list = await repo.getNotifications();
        if (!mounted.current) return;

        // seed the known set on first load; toast genuinely new arrivals
        const arrivals = list.filter((n) => !knownIds.current.has(n.id));
        if (arrivals.length > 0) {
          const isFirstLoad = knownIds.current.size === 0;
          if (!isFirstLoad) {
            const freshest = [...arrivals].sort((a, b) => b.createdAt - a.createdAt)[0];
            setToast(freshest);
            if (toastTimer.current) window.clearTimeout(toastTimer.current);
            toastTimer.current = window.setTimeout(() => setToast(null), 6500);
          }
          arrivals.forEach((n) => knownIds.current.add(n.id));
        }

        setUnreadCount(list.filter((n) => n.readAt === null).length);
      } catch {
        // API failure → real error state (no fake data). The badge just
        // stays quiet until the next successful fetch.
        if (mounted.current) setUnreadCount(0);
      }
    };

    void refresh();
    const unsub = repo.subscribe(() => void refresh());
    repo.startSimulation();

    return () => {
      mounted.current = false;
      unsub();
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [sessionStatus]);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const openToast = useCallback(() => {
    if (!toast) return;
    dismissToast();
    if (toast.type === 'USER_FOLLOWED') {
      const creator = resolveCreatorSync(toast.actorId);
      navigate(`/creators/${creator.handle}`);
    } else if (toast.type === 'MESSAGE_RECEIVED' && toast.conversationId) {
      navigate(`/messages/${toast.conversationId}`);
    } else if (toast.voiceNoteId) {
      const cached = resolveNoteSync(toast.voiceNoteId);
      if (cached) {
        play(cached, [cached]);
        navigate('/discover');
      } else {
        void createVoiceNoteRepository()
          .getById(toast.voiceNoteId)
          .then((note) => {
            if (note) play(note, [note]);
          })
          .catch(() => undefined);
        navigate('/discover');
      }
    }
  }, [toast, dismissToast, navigate, play]);

  const value = useMemo(() => ({ unreadCount }), [unreadCount]);

  const suppressToast = AUTH_ROUTES.includes(location.pathname);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {toast && !suppressToast && (
        <NotificationToast notification={toast} onDismiss={dismissToast} onOpen={openToast} />
      )}
    </NotificationContext.Provider>
  );
}

/** Unread count for nav badges (bell, side rail, bottom nav). */
export function useNotificationsBadge(): number {
  return useContext(NotificationContext).unreadCount;
}
