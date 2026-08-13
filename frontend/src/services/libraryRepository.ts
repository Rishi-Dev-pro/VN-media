import type { VoiceNote } from '../data/types';
import { voiceNotesById } from '../data/mockVoiceNotes';
import { DEMO_NOW } from '../data/mockFollowing';
import { createAlbumRepository, type AlbumSummary } from './albumRepository';

/* ============================================================
   Library repository boundary.

   The demo listener's personal library: saved VoiceNotes, saved
   collections and recently-played history. Mutations are
   session-local (module state) — refreshing the page restores
   the deterministic mock. The integration phase swaps this
   implementation for an HTTP-backed one; the UI only ever talks
   to the interface below.
   ============================================================ */

/** One entry in recently-played history. */
export interface RecentEntry {
  note: VoiceNote;
  /** when it was played (epoch ms, anchored to DEMO_NOW) */
  playedAt: number;
  /** fraction 0..1 — where the listener stopped */
  progress: number;
}

/** The whole library, resolved and ordered (newest first). */
export interface LibraryData {
  savedNotes: VoiceNote[];
  savedAlbums: AlbumSummary[];
  recents: RecentEntry[];
}

export interface LibraryRepository {
  getLibrary(): Promise<LibraryData>;
  /** resolve a set of note ids into full VoiceNotes (catalog order) */
  getNotesByIds(ids: string[]): Promise<VoiceNote[]>;
  /** remove a note from the saved list */
  removeSavedNote(noteId: string): Promise<void>;
  /** remove a collection from the saved list */
  removeSavedAlbum(albumId: string): Promise<void>;
  /** push a note to the top of recently-played */
  recordPlay(noteId: string): Promise<void>;
  /** wipe recently-played history */
  clearRecentlyPlayed(): Promise<void>;
}

/** Simulated network latency so loading states are real. */
const delay = (ms = 620) => new Promise<void>((r) => setTimeout(r, ms));

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/* ----- deterministic mock seed (session state lives below) ----- */

interface SavedItem {
  id: string;
  savedAt: number;
}

const initialSavedNotes: SavedItem[] = [
  { id: 'vn-ideas-at-2am', savedAt: DEMO_NOW - 18 * MIN },
  { id: 'vn-slow-hours', savedAt: DEMO_NOW - 34 * MIN },
  { id: 'vn-warm-static', savedAt: DEMO_NOW - 3 * HOUR },
  { id: 'vn-midnight-frequency', savedAt: DEMO_NOW - 9 * HOUR },
  { id: 'vn-paper-satellites', savedAt: DEMO_NOW - 26 * HOUR },
  { id: 'vn-after-rain', savedAt: DEMO_NOW - 2 * DAY },
  { id: 'vn-glass-horizon', savedAt: DEMO_NOW - 4 * DAY },
  { id: 'vn-harbor-whistle', savedAt: DEMO_NOW - 5 * DAY },
];

const initialSavedAlbums: SavedItem[] = [
  { id: 'alb-slow-hours', savedAt: DEMO_NOW - 1 * HOUR },
  { id: 'alb-night-field', savedAt: DEMO_NOW - 1 * DAY },
  { id: 'alb-velvet', savedAt: DEMO_NOW - 3 * DAY },
];

interface RecentSeed {
  id: string;
  playedAt: number;
  progress: number;
}

const initialRecents: RecentSeed[] = [
  { id: 'vn-ideas-at-2am', playedAt: DEMO_NOW - 12 * MIN, progress: 0.62 },
  { id: 'vn-midnight-frequency', playedAt: DEMO_NOW - 48 * MIN, progress: 0.18 },
  { id: 'vn-after-rain', playedAt: DEMO_NOW - 2 * HOUR - 30 * MIN, progress: 0.84 },
  { id: 'vn-slow-hours', playedAt: DEMO_NOW - 26 * HOUR, progress: 0.31 },
  { id: 'vn-neon-bloom', playedAt: DEMO_NOW - 2 * DAY, progress: 0.5 },
  { id: 'vn-paper-satellites', playedAt: DEMO_NOW - 3 * DAY, progress: 0.75 },
  { id: 'vn-glass-horizon', playedAt: DEMO_NOW - 4 * DAY, progress: 0.22 },
  { id: 'vn-harbor-whistle', playedAt: DEMO_NOW - 5 * DAY, progress: 0.4 },
];

/* ----- session-local mutable state ----- */

const savedNotes: SavedItem[] = [...initialSavedNotes];
const savedAlbums: SavedItem[] = [...initialSavedAlbums];
const recents: RecentSeed[] = [...initialRecents];

const albumRepo = createAlbumRepository();

function resolveRecents(): RecentEntry[] {
  return recents
    .map((r) => {
      const note = voiceNotesById[r.id];
      return note ? { note, playedAt: r.playedAt, progress: r.progress } : null;
    })
    .filter((r): r is RecentEntry => Boolean(r));
}

export const mockLibraryRepository: LibraryRepository = {
  async getLibrary() {
    await delay();
    const savedNoteIds = savedNotes.map((s) => s.id);
    const notes = savedNoteIds
      .map((id) => voiceNotesById[id])
      .filter(Boolean) as VoiceNote[];

    const albums = await albumRepo.getAlbums();
    // preserve "most recently saved first" ordering from savedAlbums
    const savedAlbumList = savedAlbums
      .map((s) => albums.find((a) => a.id === s.id))
      .filter((a): a is AlbumSummary => Boolean(a));

    return {
      savedNotes: notes,
      savedAlbums: savedAlbumList,
      recents: resolveRecents(),
    };
  },

  async getNotesByIds(ids) {
    await delay(360);
    return ids.map((id) => voiceNotesById[id]).filter(Boolean) as VoiceNote[];
  },

  async removeSavedNote(noteId) {
    await delay(240);
    const i = savedNotes.findIndex((s) => s.id === noteId);
    if (i >= 0) savedNotes.splice(i, 1);
  },

  async removeSavedAlbum(albumId) {
    await delay(240);
    const i = savedAlbums.findIndex((s) => s.id === albumId);
    if (i >= 0) savedAlbums.splice(i, 1);
  },

  async recordPlay(noteId) {
    await delay(120);
    const i = recents.findIndex((r) => r.id === noteId);
    if (i >= 0) recents.splice(i, 1);
    recents.unshift({ id: noteId, playedAt: Date.now(), progress: 0 });
    if (recents.length > 12) recents.length = 12;
  },

  async clearRecentlyPlayed() {
    await delay(240);
    recents.length = 0;
  },
};

/** Single access point — the integration phase swaps the impl here. */
export function createLibraryRepository(): LibraryRepository {
  return mockLibraryRepository;
}
