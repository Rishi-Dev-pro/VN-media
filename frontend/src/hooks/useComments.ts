import { useEffect, useState } from 'react';
import { getMockComments, type MockComment } from '../data/mockComments';
import { DEMO_LISTENER, DEMO_NOW } from '../data/mockFollowing';

const LATENCY = 520;

/** Loads a mock thread for a VoiceNote and lets the user append locally. */
export function useComments(noteId: string | null, releasedAt?: string) {
  const [comments, setComments] = useState<MockComment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!noteId) {
      setComments([]);
      return;
    }
    let active = true;
    setLoading(true);
    setComments([]);
    const t = window.setTimeout(() => {
      if (!active) return;
      setComments(getMockComments(noteId, releasedAt ?? new Date().toISOString()));
      setLoading(false);
    }, LATENCY);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [noteId, releasedAt]);

  /** Append a comment from the demo listener (local state only). */
  const addLocal = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const comment: MockComment = {
      id: `local-${Date.now()}`,
      authorName: DEMO_LISTENER.name,
      authorHandle: DEMO_LISTENER.handle,
      avatar: DEMO_LISTENER.avatar,
      text: trimmed,
      createdAt: new Date(DEMO_NOW).toISOString(),
      likes: 0,
      replies: 0,
    };
    setComments((prev) => [comment, ...prev]);
  };

  return { comments, loading, addLocal };
}
