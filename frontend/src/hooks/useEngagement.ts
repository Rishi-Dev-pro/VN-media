import { useCallback, useMemo, useRef, useState } from 'react';
import type { VoiceNote } from '../data/types';
import { createNotificationRepository } from '../services/notificationRepository';
import { createVoiceNoteRepository } from '../services/voiceNoteRepository';
import { usePlayer } from '../state/PlayerContext';

/* ============================================================
   Like engagement.

   One source of truth for the liked state stays in PlayerContext
   (`likedIds`); this hook adds the repository round-trip on top:
   optimistic flip → mock persistence → notification. A failure
   rolls the state back and surfaces a short, product-safe error.

   Deterministic demo: `?demo=like-error` makes every like/unlike
   fail once the page has loaded with the flag.
   ============================================================ */

export function useEngagement(note: VoiceNote | null) {
  const { isLiked, toggleLike } = usePlayer();
  const voiceNoteRepo = useMemo(() => createVoiceNoteRepository(), []);
  const notificationRepo = useMemo(() => createNotificationRepository(), []);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const errorTimer = useRef<number | null>(null);

  const liked = note ? isLiked(note.id) : false;
  const likeCount = note ? note.likes + (liked ? 1 : 0) : 0;

  const clearError = useCallback(() => {
    if (errorTimer.current) window.clearTimeout(errorTimer.current);
    errorTimer.current = null;
    setError(null);
  }, []);

  const toggle = useCallback(async () => {
    if (!note || busyRef.current) return;
    const wasLiked = isLiked(note.id);
    busyRef.current = true;
    setBusy(true);
    clearError();

    // optimistic flip — the whole app sees the new state immediately
    toggleLike(note.id);

    try {
      if (wasLiked) {
        await voiceNoteRepo.unlikeVoiceNote(note.id);
      } else {
        await voiceNoteRepo.likeVoiceNote(note.id);
        // one social graph: a like emits the matching incoming event.
        // Only fires on the unliked→liked transition (no duplicates).
        if ((note.visibility ?? 'public') === 'public') {
          notificationRepo.deliverLike(note.id);
        }
      }
    } catch {
      // rollback — restore the previous liked state
      toggleLike(note.id);
      setError('COULDN’T LIKE VOICENOTE.');
      errorTimer.current = window.setTimeout(clearError, 2600);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [note, isLiked, toggleLike, voiceNoteRepo, notificationRepo, clearError]);

  return { liked, likeCount, busy, error, toggle };
}
