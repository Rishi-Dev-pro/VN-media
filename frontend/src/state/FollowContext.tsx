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

/* ============================================================
   Shared follow state (local, demo).

   One place for "who is @rishi following". Following, Search and
   any future surface all read/toggle the same set, so a follow in
   Search immediately shows up in the Following feed. No backend.
   ============================================================ */

interface FollowState {
  followingIds: Set<string>;
  toggleFollow: (creatorId: string) => void;
  isFollowing: (creatorId: string) => boolean;
}

const FollowContext = createContext<FollowState | null>(null);

/* Best-effort sessionStorage mirror so the follow graph survives a hard
 * refresh within the same tab. Structural only — no backend. */
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
  const [followingIds, setFollowingIds] = useState<Set<string>>(
    () => new Set(loadPersistedFollows() ?? initialFollowing),
  );

  // live mirror so the follow side effect never reads a stale closure
  const followingRef = useRef(followingIds);
  useEffect(() => {
    followingRef.current = followingIds;
  }, [followingIds]);

  // persist the follow graph whenever it changes
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        FOLLOWS_STORAGE_KEY,
        JSON.stringify([...followingIds]),
      );
    } catch {
      // storage unavailable — persistence is best-effort
    }
  }, [followingIds]);

  const toggleFollow = useCallback((creatorId: string) => {
    const isAdding = !followingRef.current.has(creatorId);
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) next.delete(creatorId);
      else next.add(creatorId);
      return next;
    });
    // one social graph: following a creator emits the matching
    // incoming event through the notification boundary.
    if (isAdding) createNotificationRepository().deliverFollow(creatorId);
  }, []);

  const isFollowing = useCallback(
    (creatorId: string) => followingIds.has(creatorId),
    [followingIds],
  );

  const value = useMemo(
    () => ({ followingIds, toggleFollow, isFollowing }),
    [followingIds, toggleFollow, isFollowing],
  );

  return <FollowContext.Provider value={value}>{children}</FollowContext.Provider>;
}

export function useFollows(): FollowState {
  const ctx = useContext(FollowContext);
  if (!ctx) throw new Error('useFollows must be used inside <FollowProvider>');
  return ctx;
}
