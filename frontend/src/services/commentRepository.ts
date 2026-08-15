import type { MockComment } from '../data/mockComments';
import { getMockComments } from '../data/mockComments';
import { voiceNotesById } from '../data/mockVoiceNotes';
import { isApiMode } from './api/apiConfig';
import { httpCommentRepository } from './api/httpCommentRepository';

/* ============================================================
   Comment repository boundary.

   The UI talks only to the interface below. Today it is backed
   by the session-local mock implementation; in the integration
   phase an `HttpCommentRepository` implements the same interface
   against the real VN-Media API — no component changes needed.

   The repository is the single source of truth for comment
   counts (via deltas) and for privacy: seeded threads only exist
   for PUBLIC VoiceNotes, and mutations are ownership-checked.
   ============================================================ */

export interface CommentAuthor {
  name: string;
  handle: string;
  avatar: string;
}

export interface CreateCommentInput {
  text: string;
  parentId?: string;
  author: CommentAuthor;
}

export interface CommentRepository {
  /** Full thread for a note (seeded public flavor + session comments). */
  getComments(noteId: string): Promise<MockComment[]>;
  /** Live count = the note's base count + this session's delta. */
  getLiveCount(noteId: string, base: number): number;
  /** Create a comment or reply (ownership = the current author). */
  createComment(noteId: string, input: CreateCommentInput): Promise<MockComment>;
  /** Edit one of the current user's own comments. */
  updateComment(commentId: string, text: string, ownerHandle: string): Promise<MockComment>;
  /** Soft-delete one of the current user's own comments (children stay). */
  deleteComment(commentId: string, ownerHandle: string): Promise<MockComment>;
  /** fired whenever the dataset or a delta changes */
  subscribe(listener: () => void): () => void;
}

/** Simulated network latency so loading states are real. */
const delay = (ms = 420) => new Promise<void>((r) => setTimeout(r, ms));

/* ---------- deterministic demo switches ---------- */
function demo(flag: string): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === flag;
}

/** Private VoiceNotes never seed public comments. */
function hasPublicSeed(noteId: string): boolean {
  const note = voiceNotesById[noteId];
  return !note || (note.visibility ?? 'public') === 'public';
}

/* ---------- session state ---------- */

/** comments created by the current user this session, per note */
const sessionComments = new Map<string, MockComment[]>();
/** count delta per note (creation +1, deletion −1) */
const countDeltas = new Map<string, number>();
let idSeq = 1;

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

function sessionList(noteId: string): MockComment[] {
  let list = sessionComments.get(noteId);
  if (!list) {
    list = [];
    sessionComments.set(noteId, list);
  }
  return list;
}

function bump(noteId: string, amount: number): void {
  countDeltas.set(noteId, (countDeltas.get(noteId) ?? 0) + amount);
}

/** locate a session comment by id across all notes */
function findSessionComment(commentId: string): MockComment | undefined {
  for (const list of sessionComments.values()) {
    const found = list.find((c) => c.id === commentId);
    if (found) return found;
  }
  return undefined;
}

export const mockCommentRepository: CommentRepository = {
  async getComments(noteId) {
    await delay(460);
    const seeded = hasPublicSeed(noteId) ? getMockComments(noteId, voiceNotesById[noteId]?.releasedAt ?? new Date().toISOString()) : [];
    const session = sessionList(noteId);
    // newest-first; the UI groups replies under their root comment
    return [...seeded, ...session].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  },

  getLiveCount(noteId, base) {
    return base + (countDeltas.get(noteId) ?? 0);
  },

  async createComment(noteId, input) {
    await delay(380);
    if (demo('comment-error')) throw new Error('Mock comment failed (demo)');
    const text = input.text.trim();
    if (!text) throw new Error('Comment is empty');
    if (text.length > 500) throw new Error('Comment is too long');

    const comment: MockComment = {
      id: `session-c${idSeq++}`,
      voiceNoteId: noteId,
      parentCommentId: input.parentId,
      authorName: input.author.name,
      authorHandle: input.author.handle,
      avatar: input.author.avatar,
      text,
      createdAt: new Date().toISOString(),
      likes: 0,
      status: 'active',
    };

    sessionList(noteId).unshift(comment);
    bump(noteId, 1);
    notify();
    return { ...comment };
  },

  async updateComment(commentId, text, ownerHandle) {
    await delay(320);
    if (demo('comment-error')) throw new Error('Mock comment failed (demo)');
    const comment = findSessionComment(commentId);
    if (!comment || comment.authorHandle !== ownerHandle) {
      throw new Error('Not your comment');
    }
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Comment is empty');
    comment.text = trimmed;
    notify();
    return { ...comment };
  },

  async deleteComment(commentId, ownerHandle) {
    await delay(300);
    if (demo('comment-error')) throw new Error('Mock comment failed (demo)');
    const comment = findSessionComment(commentId);
    if (!comment || comment.authorHandle !== ownerHandle) {
      throw new Error('Not your comment');
    }
    const wasActive = comment.status === 'active';
    comment.status = 'deleted';
    comment.text = '';
    if (wasActive) bump(comment.voiceNoteId, -1);
    notify();
    return { ...comment };
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Single access point — mode switch lives here. */
export function createCommentRepository(): CommentRepository {
  return isApiMode ? httpCommentRepository : mockCommentRepository;
}
