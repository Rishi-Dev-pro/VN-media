import { useCallback, useEffect, useRef, useState } from 'react';
import type { MockComment } from '../data/mockComments';
import type { AuthUser } from '../services/authRepository';
import { createAuthRepository } from '../services/authRepository';
import { createCommentRepository, type CommentRepository } from '../services/commentRepository';
import { createNotificationRepository } from '../services/notificationRepository';
import { isApiMode } from '../services/api/apiConfig';

/* ============================================================
   Comments hook.

   UI → hook → commentRepository → mock. The hook owns loading,
   optimistic submit/edit/delete with rollback, and the current
   user's identity (used for ownership + the composer avatar).
   ============================================================ */

const repo: CommentRepository = createCommentRepository();

export function useComments(noteId: string | null) {
  const [comments, setComments] = useState<MockComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const noteRef = useRef(noteId);
  noteRef.current = noteId;
  const errorTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    const id = noteRef.current;
    if (!id) {
      setComments([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const list = await repo.getComments(id);
      setComments(list);
    } catch {
      setLoadError('We couldn’t load this conversation.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setActionError(null);
    void load();
    return () => {
      if (errorTimer.current) window.clearTimeout(errorTimer.current);
    };
  }, [noteId, load]);

  // identity for ownership + the composer avatar
  useEffect(() => {
    let active = true;
    void createAuthRepository()
      .getCurrentUser()
      .then((user) => {
        if (active) setCurrentUser(user);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const clearActionError = useCallback(() => {
    if (errorTimer.current) window.clearTimeout(errorTimer.current);
    errorTimer.current = null;
    setActionError(null);
  }, []);

  const fail = useCallback((msg: string) => {
    setActionError(msg);
    if (errorTimer.current) window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(clearActionError, 2600);
  }, [clearActionError]);

  /** Optimistic submit — the comment appears, then the repo confirms. */
  const submit = useCallback(
    async (text: string, parentId?: string) => {
      const trimmed = text.trim();
      if (!trimmed || !noteRef.current || !currentUser) return;
      if (submitting) return;

      const temp: MockComment = {
        id: `pending-${Date.now()}`,
        voiceNoteId: noteRef.current,
        parentCommentId: parentId,
        authorName: currentUser.name,
        authorHandle: currentUser.handle,
        avatar: currentUser.avatar,
        text: trimmed,
        createdAt: new Date().toISOString(),
        likes: 0,
        status: 'active',
      };

      setSubmitting(true);
      clearActionError();
      setComments((prev) => [temp, ...prev]);

      try {
        const saved = await repo.createComment(noteRef.current, {
          text: trimmed,
          parentId,
          author: {
            name: currentUser.name,
            handle: currentUser.handle,
            avatar: currentUser.avatar,
          },
        });
        setComments((prev) => prev.map((c) => (c.id === temp.id ? saved : c)));
        // one social graph: a comment emits the matching incoming event.
        // Mock mode only — the repository enforces the public boundary;
        // in API mode the backend generates VOICE_NOTE_COMMENTED itself.
        if (!isApiMode) {
          createNotificationRepository().deliverComment(noteRef.current, trimmed);
        }
      } catch {
        // rollback — remove the optimistic comment
        setComments((prev) => prev.filter((c) => c.id !== temp.id));
        fail('COULDN’T POST COMMENT.');
      } finally {
        setSubmitting(false);
      }
    },
    [currentUser, submitting, clearActionError, fail],
  );

  /** Optimistic edit of one of the user's own comments. */
  const update = useCallback(
    async (commentId: string, text: string) => {
      if (!currentUser) return;
      const trimmed = text.trim();
      const prev = comments.find((c) => c.id === commentId);
      if (!prev || !trimmed || prev.status !== 'active') return;

      setComments((cs) =>
        cs.map((c) => (c.id === commentId ? { ...c, text: trimmed } : c)),
      );
      try {
        await repo.updateComment(commentId, trimmed, currentUser.handle);
      } catch {
        setComments((cs) => cs.map((c) => (c.id === commentId ? prev : c)));
        fail('COULDN’T SAVE COMMENT.');
      }
    },
    [currentUser, comments, fail],
  );

  /** Optimistic soft-delete (text hidden, replies preserved). */
  const remove = useCallback(
    async (commentId: string) => {
      if (!currentUser) return;
      const prev = comments.find((c) => c.id === commentId);
      if (!prev || prev.status === 'deleted') return;

      setComments((cs) =>
        cs.map((c) =>
          c.id === commentId ? { ...c, status: 'deleted' as const, text: '' } : c,
        ),
      );
      try {
        await repo.deleteComment(commentId, currentUser.handle);
      } catch {
        setComments((cs) => cs.map((c) => (c.id === commentId ? prev : c)));
        fail('COULDN’T DELETE COMMENT.');
      }
    },
    [currentUser, comments, fail],
  );

  return {
    comments,
    loading,
    loadError,
    actionError,
    submitting,
    currentUser,
    retry: load,
    submit,
    update,
    remove,
    clearActionError,
  };
}
