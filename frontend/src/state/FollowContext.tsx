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
import { initialFollowing } from '../data/mockFollowing';
import { createNotificationRepository } from '../services/notificationRepository';
import { isApiMode } from '../services/api/apiConfig';
import { apiRequest } from '../services/api/apiClient';
import { getCurrentUserId } from '../services/api/session';
import { useSession } from './SessionContext';
import type { BackendUser } from '../services/api/mappers';

/* ============================================================
   Shared follow state.

   One place for "who am I following". Following, Search, Creator
   profiles and any future surface all read/toggle the same set.

   Mock mode: session-local set (+ sessionStorage persistence),
   toggling emits a local follow notification.

   API mode: the server is authoritative. The set hydrates from
   GET /api/users/:me/following; toggles are optimistic with
   rollback and go through POST/DELETE /api/users/:id/follow.
   The backend generates USER_FOLLOWED notifications itself —
   this context never fabricates them.
   ============================================================ */

interface FollowState {
  followingIds: Set<string>;
  toggleFollow: (creatorId: string) => void;
  isFollowing: (creatorId: string) => boolean;
  /** transient message when an API follow/unfollow fails (rollback shown) */
  followError: string | null;
  clearFollowError: () => void;
}

const FollowContext = createContext<FollowState | null>(null);

const FOLLOWS_STORAGE_KEY = 'vn.follows.session.v1';

function loadPersistedFollows(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(FOLLOWS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
      return null;
    }
    return parsed as string[];
  } catch {
    return null;
  }
}

export function FollowProvider({ children }: { children: ReactNode }) {
  const sessionStatus = useSession();
  const [followingIds, setFollowingIds] = useState<Set<string>>(
    () => new Set(isApiMode ? [] : (loadPersistedFollows() ?? initialFollowing)),
  );
  const [followError, setFollowError] = useState<string | null>(null);
  const errorTimer = useRef<number | null>(null);

  // live mirror so the follow side effect never reads a stale closure
  const followingRef = useRef(followingIds);
  useEffect(() => {
    followingRef.current = followingIds;
  }, [followingIds]);

  // API mode: hydrate the graph from the server whenever the session
  // becomes valid (mount, login, logout) — the server is authoritative
  // and the FollowProvider outlives login, so hydration is keyed on the
  // session status rather than running once.
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isApiMode) return;
    if (sessionStatus !== 'authenticated') {
      if (sessionStatus === 'unauthenticated') {
        // Session cleared (logout / 401): drop the previous account's graph
        // AND forget it was hydrated — so the same user (or the next one)
        // rehydrates cleanly on the next login instead of being skipped.
        hydratedFor.current = null;
        setFollowingIds(new Set());
      }
      return;
    }

    const me = getCurrentUserId();
    if (!me || hydratedFor.current === me) return;
    hydratedFor.current = me;

    let active = true;
    (async () => {
      try {
        const data = await apiRequest<{ following?: BackendUser[] }>(
          `/users/${encodeURIComponent(me)}/following`,
          { query: { limit: 100 } },
        );
        if (active) setFollowingIds(new Set((data.following ?? []).map((u) => u.id)));
      } catch {
        if (active) setFollowingIds(new Set());
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  // mock mode: persist the graph across reloads
  useEffect(() => {
    if (isApiMode) return;
    try {
      window.sessionStorage.setItem(FOLLOWS_STORAGE_KEY, JSON.stringify([...followingIds]));
    } catch {
      /* best-effort */
    }
  }, [followingIds]);

  const showError = useCallback((message: string) => {
    setFollowError(message);
    if (errorTimer.current) window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setFollowError(null), 3000);
  }, []);

  const toggleFollow = useCallback(
    (creatorId: string) => {
      const isAdding = !followingRef.current.has(creatorId);

      if (isApiMode) {
        // optimistic flip, then the server is the source of truth
        setFollowingIds((prev) => {
          const next = new Set(prev);
          if (next.has(creatorId)) next.delete(creatorId);
          else next.add(creatorId);
          return next;
        });

        const request = isAdding
          ? apiRequest(`/users/${encodeURIComponent(creatorId)}/follow`, { method: 'POST' })
          : apiRequest(`/users/${encodeURIComponent(creatorId)}/follow`, { method: 'DELETE' });

        request.catch(() => {
          // rollback to the previous state
          setFollowingIds((prev) => {
            const next = new Set(prev);
            if (isAdding) next.delete(creatorId);
            else next.add(creatorId);
            return next;
          });
          showError("COULDN'T UPDATE FOLLOW. TRY AGAIN.");
        });
        return;
      }

      // mock mode — same optimistic flip, plus the local follow event
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (next.has(creatorId)) next.delete(creatorId);
        else next.add(creatorId);
        return next;
      });
      if (isAdding) createNotificationRepository().deliverFollow(creatorId);
    },
    [showError],
  );

  const clearFollowError = useCallback(() => setFollowError(null), []);

  const isFollowing = useCallback(
    (creatorId: string) => followingIds.has(creatorId),
    [followingIds],
  );

  const value = useMemo(
    () => ({ followingIds, toggleFollow, isFollowing, followError, clearFollowError }),
    [followingIds, toggleFollow, isFollowing, followError, clearFollowError],
  );

  return <FollowContext.Provider value={value}>{children}</FollowContext.Provider>;
}

export function useFollows(): FollowState {
  const ctx = useContext(FollowContext);
  if (!ctx) throw new Error('useFollows must be used inside <FollowProvider>');
  return ctx;
}
