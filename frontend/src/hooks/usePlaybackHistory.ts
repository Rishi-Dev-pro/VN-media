import { useEffect, useMemo, useRef } from 'react';
import { createLibraryRepository } from '../services/libraryRepository';
import { usePlayer } from '../state/PlayerContext';

/* ============================================================
   Playback history (global).

   Mounted once in the app shell so EVERY playback through the
   global player flows into the existing library repository —
   regardless of which page started it.

   Rules (deterministic, no duplicate records):
   - starting a note records it as recently played (fresh, 0%)
   - pausing or leaving the page saves where the listener stopped
     (meaningful playback only: > 3s in, and not the last 2s —
     so completed notes don't linger as partial)
   ============================================================ */

const MIN_SAVE_FRACTION = 0.02; // ~3s on a 2:30 note

export function usePlaybackHistory(): void {
  const { current, isPlaying, elapsed } = usePlayer();
  const repo = useMemo(() => createLibraryRepository(), []);

  const prevNoteId = useRef<string | null>(null);
  const currentElapsed = useRef(0);
  currentElapsed.current = elapsed;

  // a new note started — record it as recently played
  useEffect(() => {
    if (!current) {
      prevNoteId.current = null;
      return;
    }
    if (current.id !== prevNoteId.current) {
      prevNoteId.current = current.id;
      void repo.recordPlay(current.id);
    }
  }, [current, repo]);

  // pausing mid-note saves the resume position
  useEffect(() => {
    if (!current) return;
    if (!isPlaying && currentElapsed.current > 3) {
      const frac = currentElapsed.current / current.duration;
      if (current.duration > 0 && frac < 1 - MIN_SAVE_FRACTION) {
        void repo.recordProgress(current.id, frac);
      }
    }
  }, [isPlaying, current, repo]);

  // leaving the page (or closing the tab) saves progress
  useEffect(() => {
    const save = () => {
      if (!current) return;
      const frac = currentElapsed.current / current.duration;
      if (current.duration > 0 && currentElapsed.current > 3 && frac < 1 - MIN_SAVE_FRACTION) {
        void repo.recordProgress(current.id, frac);
      }
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [current, repo]);
}
