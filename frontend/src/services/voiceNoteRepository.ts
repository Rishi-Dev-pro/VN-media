import type { Album, Creator, VoiceNote } from '../data/types';
import { mockAlbums } from '../data/mockAlbums';
import { mockCreators } from '../data/mockCreators';
import {
  featuredOrder,
  mockVoiceNotes,
  recentlyPlayedIds,
  voiceNotesById,
} from '../data/mockVoiceNotes';

/* ============================================================
   Repository boundary.

   The UI talks to this interface only. Today it is backed by
   the mock implementation below; in the integration phase a
   `HttpVoiceNoteRepository` will implement the same interface
   against the real VN-Media API — no component changes needed.
   ============================================================ */

export interface VoiceNoteRepository {
  getFeatured(): Promise<VoiceNote[]>;
  getTrending(): Promise<VoiceNote[]>;
  getNewest(): Promise<VoiceNote[]>;
  getRecentlyPlayed(): Promise<VoiceNote[]>;
  getById(id: string): Promise<VoiceNote | null>;
  getRelated(note: VoiceNote, limit?: number): Promise<VoiceNote[]>;
  getCreators(): Promise<Creator[]>;
  getAlbums(): Promise<Album[]>;
  /** persist a like (mock — fails deterministically with ?demo=like-error) */
  likeVoiceNote(noteId: string): Promise<void>;
  /** persist an unlike */
  unlikeVoiceNote(noteId: string): Promise<void>;
}

/** Public discovery only — private VoiceNotes never leave the boundary. */
const isPublic = (n: VoiceNote) => (n.visibility ?? 'public') === 'public';

/** Simulated network latency so loading states are real. */
const delay = (ms = 700) => new Promise<void>((r) => setTimeout(r, ms));

/** Deterministic demo switches — reproducible failures only. */
function demo(flag: string): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === flag;
}

export const mockVoiceNoteRepository: VoiceNoteRepository = {
  async getFeatured() {
    await delay();
    return featuredOrder
      .map((id) => voiceNotesById[id])
      .filter((n): n is VoiceNote => Boolean(n) && isPublic(n));
  },

  async getTrending() {
    await delay(620);
    return [...mockVoiceNotes]
      .filter(isPublic)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 6);
  },

  async getNewest() {
    await delay(580);
    return [...mockVoiceNotes]
      .filter(isPublic)
      .sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt))
      .slice(0, 6);
  },

  async getRecentlyPlayed() {
    await delay(480);
    return recentlyPlayedIds
      .map((id) => voiceNotesById[id])
      .filter((n): n is VoiceNote => Boolean(n));
  },

  async getById(id) {
    await delay(300);
    return voiceNotesById[id] ?? null;
  },

  async getRelated(note, limit = 4) {
    await delay(420);
    const related = mockVoiceNotes.filter(
      (v) =>
        v.id !== note.id &&
        isPublic(v) &&
        (v.category === note.category || v.tags.some((t) => note.tags.includes(t))),
    );
    return related.slice(0, limit);
  },

  async getCreators() {
    await delay();
    return mockCreators;
  },

  async getAlbums() {
    await delay();
    return mockAlbums;
  },

  async likeVoiceNote() {
    await delay(380);
    if (demo('like-error')) throw new Error('Mock like failed (demo)');
  },

  async unlikeVoiceNote() {
    await delay(340);
    if (demo('like-error')) throw new Error('Mock unlike failed (demo)');
  },
};

/** Single access point — the integration phase swaps the impl here. */
export function createVoiceNoteRepository(): VoiceNoteRepository {
  return mockVoiceNoteRepository;
}
