import { useCallback, useEffect, useMemo, useState } from 'react';
import type { VoiceNote } from '../data/types';
import { DEMO_NOW } from '../data/mockFollowing';
import { useFollows } from '../state/FollowContext';
import {
  createFollowingRepository,
  type FollowingCreator,
  type FollowingFeed,
} from '../services/followingRepository';

const repo = createFollowingRepository();

export type FeedFilter = 'all' | 'recent' | 'creators';

export type FeedSort = 'latest' | 'liked' | 'played';

/** Window used by the RECENT filter (hours). */
const RECENT_WINDOW_MS = 72 * 60 * 60 * 1000;

export interface UseFollowing {
  creators: FollowingCreator[];
  notes: VoiceNote[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  /** ids the demo listener currently follows */
  followingIds: Set<string>;
  toggleFollow: (creatorId: string) => void;
  isFollowing: (creatorId: string) => boolean;
  filter: FeedFilter;
  setFilter: (f: FeedFilter) => void;
  /** ordering of the feed within the active filter */
  sort: FeedSort;
  setSort: (s: FeedSort) => void;
  /** creator filter (\"all from @handle\") */
  selectedCreator: string | null;
  selectCreator: (creatorId: string | null) => void;
  /** notes shown in the feed after all filters */
  visibleNotes: VoiceNote[];
  newThisWeek: number;
}

/**
 * Loads the following feed through the repository. Follow state,
 * filters and the selected creator live here (page-local), while
 * playback stays in the global PlayerContext.
 */
export function useFollowing(): UseFollowing {
  const { followingIds, toggleFollow, isFollowing } = useFollows();
  const [creators, setCreators] = useState<FollowingCreator[]>([]);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [newThisWeek, setNewThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [sort, setSort] = useState<FeedSort>('latest');
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data: FollowingFeed = await repo.getFollowingFeed([...followingIds]);
      setCreators(data.creators);
      setNotes(data.notes);
      setNewThisWeek(data.newThisWeek);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [followingIds]);

  // Initial load — runs once. `load` re-runs on retry or when the
  // follow set changes (feed membership follows the circle).
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followingIds]);

  const selectCreator = useCallback((creatorId: string | null) => {
    setSelectedCreator(creatorId);
  }, []);

  const visibleNotes = useMemo(() => {
    let list = notes;
    if (selectedCreator) {
      list = list.filter((n) => n.creatorId === selectedCreator);
    }
    if (filter === 'recent') {
      const cutoff = DEMO_NOW - RECENT_WINDOW_MS;
      list = list.filter((n) => +new Date(n.releasedAt) >= cutoff);
    }
    // the repository returns newest-first; other orders re-sort stably
    if (sort === 'liked') {
      list = [...list].sort(
        (a, b) => b.likes - a.likes || +new Date(b.releasedAt) - +new Date(a.releasedAt),
      );
    } else if (sort === 'played') {
      list = [...list].sort(
        (a, b) => b.plays - a.plays || +new Date(b.releasedAt) - +new Date(a.releasedAt),
      );
    }
    return list;
  }, [notes, selectedCreator, filter, sort]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  return {
    creators,
    notes,
    loading,
    error,
    retry,
    followingIds,
    toggleFollow,
    isFollowing,
    filter,
    setFilter,
    sort,
    setSort,
    selectedCreator,
    selectCreator,
    visibleNotes,
    newThisWeek,
  };
}
