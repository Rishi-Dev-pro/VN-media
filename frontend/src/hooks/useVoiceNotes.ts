import { useEffect, useState } from 'react';
import type { VoiceNote } from '../data/types';
import { createVoiceNoteRepository } from '../services/voiceNoteRepository';

const repo = createVoiceNoteRepository();

export interface DiscoverData {
  featured: VoiceNote[];
  trending: VoiceNote[];
  recentlyPlayed: VoiceNote[];
  loading: boolean;
}

/** Loads the data behind the Discover page through the repository. */
export function useVoiceNotes(): DiscoverData {
  const [data, setData] = useState<DiscoverData>({
    featured: [],
    trending: [],
    recentlyPlayed: [],
    loading: true,
  });

  useEffect(() => {
    let active = true;

    Promise.all([
      repo.getFeatured(),
      repo.getTrending(),
      repo.getRecentlyPlayed(),
    ]).then(([featured, trending, recentlyPlayed]) => {
      if (!active) return;
      setData({ featured, trending, recentlyPlayed, loading: false });
    });

    return () => {
      active = false;
    };
  }, []);

  return data;
}
