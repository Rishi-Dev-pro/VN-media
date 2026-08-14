import { useEffect, useState } from 'react';
import { createCommentRepository } from '../services/commentRepository';

/* ============================================================
   Live comment count.

   The note's base `comments` number comes from mock data; this
   session's deltas (comments created / deleted) live in the
   comment repository. This hook subscribes so every card showing
   a count stays consistent with the thread the user is editing.
   ============================================================ */

export function useCommentCount(noteId: string | null, base: number): number {
  const repo = createCommentRepository();
  const [count, setCount] = useState(() =>
    noteId ? repo.getLiveCount(noteId, base) : base,
  );

  useEffect(() => {
    if (!noteId) {
      setCount(base);
      return;
    }
    setCount(repo.getLiveCount(noteId, base));
    const unsub = repo.subscribe(() => {
      setCount(repo.getLiveCount(noteId, base));
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, base]);

  return count;
}
