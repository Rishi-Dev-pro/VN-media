import { useCallback, useEffect, useMemo, useState } from 'react';
import { voiceNotesById } from '../data/mockVoiceNotes';
import { usePlayer } from '../state/PlayerContext';
import type { VoiceNote } from '../data/types';
import {
  createLibraryRepository,
  type LibraryData,
  type RecentEntry,
} from '../services/libraryRepository';
import type { AlbumSummary as AlbumRow } from '../services/albumRepository';

type AlbumSummary = AlbumRow;

const repo = createLibraryRepository();

/** Demo switch — `/library?demo=error` forces the error state. */
function demoError(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('demo') === 'error';
  } catch {
    return false;
  }
}

export type NoteSort = 'recentlyAdded' | 'recentlyPlayed' | 'mostLiked' | 'az';
export type AlbumSort = 'recentlySaved' | 'released' | 'plays' | 'az';

export interface LibraryStats {
  saved: number;
  albums: number;
  liked: number;
  recent: number;
}

interface LibraryState {
  loading: boolean;
  error: boolean;
  retry: () => void;

  savedNotes: VoiceNote[];
  savedAlbums: AlbumSummary[];
  recents: RecentEntry[];
  /** notes the demo listener has liked — single source of truth is PlayerContext */
  likedNotes: VoiceNote[];

  stats: LibraryStats;

  removeSavedNote: (id: string) => void;
  removeSavedAlbum: (id: string) => void;
  recordPlay: (id: string) => void;
  clearHistory: () => void;
}

/** Personal library: saved notes/albums + recents + liked (from the player). */
export function useLibrary(): LibraryState {
  const { likedIds } = usePlayer();

  const [data, setData] = useState<LibraryData>({
    savedNotes: [],
    savedAlbums: [],
    recents: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (demoError()) throw new Error('demo error');
      const lib = await repo.getLibrary();
      setData(lib);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  /* ---- liked notes resolve through the player's likedIds ---- */
  const likedNotes = useMemo(
    () =>
      Array.from(likedIds)
        .map((id) => voiceNotesById[id])
        .filter(Boolean) as VoiceNote[],
    [likedIds],
  );

  /* ---- mutations: update repo + local state ---- */
  const removeSavedNote = useCallback((id: string) => {
    void repo.removeSavedNote(id).then(() => {
      setData((prev) => ({ ...prev, savedNotes: prev.savedNotes.filter((n) => n.id !== id) }));
    });
  }, []);

  const removeSavedAlbum = useCallback((id: string) => {
    void repo.removeSavedAlbum(id).then(() => {
      setData((prev) => ({ ...prev, savedAlbums: prev.savedAlbums.filter((a) => a.id !== id) }));
    });
  }, []);

  const recordPlay = useCallback((id: string) => {
    void repo.recordPlay(id).then(() => {
      void repo.getLibrary().then((lib) => {
        setData((prev) => ({ ...prev, recents: lib.recents }));
      });
    });
  }, []);

  const clearHistory = useCallback(() => {
    void repo.clearRecentlyPlayed().then(() => {
      setData((prev) => ({ ...prev, recents: [] }));
    });
  }, []);

  const stats = useMemo<LibraryStats>(
    () => ({
      saved: data.savedNotes.length,
      albums: data.savedAlbums.length,
      liked: likedNotes.length,
      recent: data.recents.length,
    }),
    [data, likedNotes],
  );

  return {
    loading,
    error,
    retry,
    savedNotes: data.savedNotes,
    savedAlbums: data.savedAlbums,
    recents: data.recents,
    likedNotes,
    stats,
    removeSavedNote,
    removeSavedAlbum,
    recordPlay,
    clearHistory,
  };
}

/* ============================================================
   Sorting / search helpers — deterministic, memo-friendly.
   ============================================================ */

export function searchNotes(notes: VoiceNote[], query: string): VoiceNote[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((n) => {
    const creator = n.creatorId.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q)) ||
      creator.includes(q)
    );
  });
}

export function searchAlbums(albums: AlbumRow[], query: string): AlbumRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return albums;
  return albums.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.creatorName.toLowerCase().includes(q) ||
      a.creatorHandle.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q),
  );
}

/** recents order (most recent first) as a map of id → position */
function recentsRank(recents: RecentEntry[]): Map<string, number> {
  return new Map(recents.map((r, i) => [r.note.id, i]));
}

export function sortNotes(notes: VoiceNote[], sort: NoteSort, recents: RecentEntry[]): VoiceNote[] {
  const rank = recentsRank(recents);
  const arr = [...notes];
  switch (sort) {
    case 'recentlyPlayed':
      return arr.sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
    case 'mostLiked':
      return arr.sort((a, b) => b.likes - a.likes);
    case 'az':
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return arr; // already "recently added" (repository order)
  }
}

export function sortAlbums(albums: AlbumRow[], sort: AlbumSort): AlbumRow[] {
  const arr = [...albums];
  switch (sort) {
    case 'released':
      return arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    case 'plays':
      return arr.sort((a, b) => b.plays - a.plays);
    case 'az':
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return arr; // already "recently saved" (repository order)
  }
}
