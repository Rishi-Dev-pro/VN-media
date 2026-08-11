import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { initialFollowing } from '../data/mockFollowing';

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

export function FollowProvider({ children }: { children: ReactNode }) {
  const [followingIds, setFollowingIds] = useState<Set<string>>(
    () => new Set(initialFollowing),
  );

  const toggleFollow = useCallback((creatorId: string) => {
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) next.delete(creatorId);
      else next.add(creatorId);
      return next;
    });
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
