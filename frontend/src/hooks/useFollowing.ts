import { useCallback, useEffect, useMemo, useState } from 'react';
import type { VoiceNote } from '../data/types';
import { mockAlbums } from '../data/mockAlbums';
import { DEMO_NOW } from '../data/mockFollowing';
import { useFollows } from '../state/FollowContext';
import { createVoiceNoteRepository } from '../services/voiceNoteRepository';
import {
  createFollowingRepository,
  type FollowingCreator,
  type FollowingFeed,
} from '../services/followingRepository';

const repo = createFollowingRepository();

export type FeedFilter = 'all' | 'new' | 'albums' | 'creators';

export type FeedSort = 'latest' | 'liked' | 'played';

/** Window used by the NEW filter (hours). */
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface UseFollowing {
  /** every known creator (rail + recommendations) */
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
  /** notes shown in the feed after all filters */
  visibleNotes: VoiceNote[];
  /** newest note from the followed creators (featured card) */
  featuredNote: VoiceNote | null;
  /** recently played history for the Continue listening strip */
  recentlyPlayed: VoiceNote[];
  /** notes that belong to a public album (the ALBUMS filter) */
  albumNotes: Set<string>;
  newThisWeek: number;
}

/**
 * Loads the following feed through the repository. Follow state lives
 * in the shared FollowContext (one social graph for the whole app),
 * while playback stays in the global PlayerContext.
 */
export function useFollowing(): UseFollowing {
  const { followingIds, toggleFollow, isFollowing } = useFollows();
  const [creators, setCreators] = useState<FollowingCreator[]>([]);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<VoiceNote[]>([]);
  const [newThisWeek, setNewThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [sort, setSort] = useState<FeedSort>('latest');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data: FollowingFeed = await repo.getFollowingFeed([...followingIds]);
      setCreators(data.creators);
      setNotes(data.notes);
      setNewThisWeek(data.newThisWeek);
      const played = await createVoiceNoteRepository().getRecentlyPlayed();
      setRecentlyPlayed(played);
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

  /** noteIds that appear in any public album (for the ALBUMS filter). */
  const albumNotes = useMemo(
    () =>
      new Set(
        mockAlbums
          .filter((a) => (a.visibility ?? 'public') === 'public')
          .flatMap((a) => a.voiceNoteIds),
      ),
    [],
  );

  const featuredNote = useMemo(() => notes[0] ?? null, [notes]);

  const visibleNotes = useMemo(() => {
    let list = notes;
    if (filter === 'new') {
      const cutoff = DEMO_NOW - NEW_WINDOW_MS;
      list = list.filter((n) => +new Date(n.releasedAt) >= cutoff);
    } else if (filter === 'albums') {
      list = list.filter((n) => albumNotes.has(n.id));
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
  }, [notes, filter, sort, albumNotes]);

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
    visibleNotes,
    featuredNote,
    recentlyPlayed,
    albumNotes,
    newThisWeek,
  };
}
