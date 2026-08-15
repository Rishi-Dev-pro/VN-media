/* ============================================================
   HTTP comment repository (Phase 18, API mode).

     GET    /api/vns/:id/comments            full thread (flattened)
     POST   /api/vns/:id/comments            create comment / reply
     DELETE /api/vns/:id/comments/:commentId soft delete (owner only)

   Contract gaps (documented, never faked):
     - EDIT: the backend has no PATCH comment endpoint, so
       `updateComment` throws a clear error — the UI rolls back and
       shows failure rather than pretending the edit persisted.
     - Live counts stay anchored to the backend's commentCount
       (`base`) with this session's create/delete delta, so cards
       and the drawer stay consistent without polling.
   ============================================================ */

import type { MockComment } from '../../data/mockComments';
import { apiRequest } from './apiClient';
import { mapComments, type BackendComment } from './mappers';
import type { CommentRepository, CreateCommentInput } from '../commentRepository';

/* commentId → voiceNoteId (needed for DELETE without a note id in the interface) */
const noteByCommentId = new Map<string, string>();
const countDeltas = new Map<string, number>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export const httpCommentRepository: CommentRepository = {
  async getComments(noteId) {
    const data = await apiRequest<{ items?: BackendComment[] }>(`/vns/${noteId}/comments`, {
      query: { limit: 100 },
    });
    const comments = mapComments(data.items ?? []);
    for (const c of comments) noteByCommentId.set(c.id, noteId);
    return comments;
  },

  getLiveCount(noteId, base) {
    return base + (countDeltas.get(noteId) ?? 0);
  },

  async createComment(noteId, input: CreateCommentInput) {
    const data = await apiRequest<{ comment: BackendComment }>(`/vns/${noteId}/comments`, {
      method: 'POST',
      body: {
        content: input.text,
        ...(input.parentId ? { parentCommentId: input.parentId } : {}),
      },
    });
    const [mapped] = mapComments([data.comment]);
    noteByCommentId.set(mapped.id, noteId);
    bump(noteId, 1);
    return mapped;
  },

  async updateComment(_commentId, _ownerHandle) {
    // Contract gap: the backend exposes no comment-edit endpoint.
    const err = new Error("COMMENT EDITING ISN'T AVAILABLE HERE YET.");
    (err as Error & { statusCode?: number }).statusCode = 501;
    throw err;
  },

  async deleteComment(commentId) {
    const noteId = noteByCommentId.get(commentId);
    if (!noteId) throw new Error('Comment not found');
    await apiRequest(`/vns/${noteId}/comments/${commentId}`, { method: 'DELETE' });
    bump(noteId, -1);
    return {
      id: commentId,
      voiceNoteId: noteId,
      parentCommentId: undefined,
      authorName: '',
      authorHandle: '',
      avatar: '',
      text: '',
      createdAt: new Date().toISOString(),
      likes: 0,
      status: 'deleted' as const,
    } as MockComment;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

function bump(noteId: string, amount: number): void {
  countDeltas.set(noteId, (countDeltas.get(noteId) ?? 0) + amount);
  notify();
}
