import { useCallback, useEffect, useState } from 'react';
import type { VoiceNote } from '../data/types';
import { createVoiceNoteRepository } from '../services/voiceNoteRepository';

const repo = createVoiceNoteRepository();

export interface DiscoverData {
  featured: VoiceNote[];
  trending: VoiceNote[];
  recentlyPlayed: VoiceNote[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}

/** Loads the data behind the Discover page through the repository. */
export function useVoiceNotes(): DiscoverData {
  const [data, setData] = useState<DiscoverData>({
    featured: [],
    trending: [],
    recentlyPlayed: [],
    loading: true,
    error: false,
    retry: () => undefined,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setData({
      featured: [],
      trending: [],
      recentlyPlayed: [],
      loading: true,
      error: false,
      retry: () => undefined,
    });

    Promise.all([
      repo.getFeatured(),
      repo.getTrending(),
      repo.getRecentlyPlayed(),
    ])
      .then(([featured, trending, recentlyPlayed]) => {
        if (!active) return;
        setData({ featured, trending, recentlyPlayed, loading: false, error: false, retry: () => undefined });
      })
      .catch(() => {
        if (!active) return;
        setData((prev) => ({ ...prev, loading: false, error: true }));
      });

    return () => {
      active = false;
    };
  }, [tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { ...data, retry };
}
