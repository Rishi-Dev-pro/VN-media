import type { VoiceNote } from '../data/types';
import { voiceNotesById } from '../data/mockVoiceNotes';
import { DEMO_NOW } from '../data/mockFollowing';
import { createAlbumRepository, type AlbumSummary } from './albumRepository';
import { isApiMode } from './api/apiConfig';
import * as httpLibraryModule from './api/httpLibraryRepository';

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
  /** move a note to the top with a resume position (fraction 0..1) */
  recordProgress(noteId: string, progress: number): Promise<void>;
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

/* ----- session persistence -----
 * Best-effort sessionStorage mirror of the demo listener's library so
 * saved items and Recently Played survive a hard refresh within the
 * same tab. Structural only — no backend, no secrets. Shared by the
 * mock and HTTP implementations (API mode resolves ids through the
 * real backend, never the mock catalog). */
export const LIBRARY_STORAGE_KEY = 'vn.library.session.v1';

export interface PersistedLibrary {
  savedNotes: SavedItem[];
  savedAlbums: SavedItem[];
  recents: RecentSeed[];
}

function loadPersistedLibrary(): PersistedLibrary | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedLibrary;
    const validSaved = (arr?: unknown): arr is SavedItem[] =>
      Array.isArray(arr) &&
      arr.every(
        (s) => s && typeof s.id === 'string' && typeof s.savedAt === 'number',
      );
    const validRecents = (arr?: unknown): arr is RecentSeed[] =>
      Array.isArray(arr) &&
      arr.every(
        (r) =>
          r &&
          typeof r.id === 'string' &&
          typeof r.playedAt === 'number' &&
          typeof r.progress === 'number',
      );
    if (!validSaved(p.savedNotes) || !validSaved(p.savedAlbums) || !validRecents(p.recents)) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

/** ObjectIds are 24 hex chars — mock ids (e.g. `vn-neon-bloom`) never
 *  match, so stale mock-mode sessions can't leak into the real API. */
function apiSafeIds<T extends { id: string }>(items: T[]): T[] {
  return items.filter((s) => /^[0-9a-f]{24}$/.test(s.id));
}

/** Local library state — persisted copy wins, else deterministic seeds
 *  (empty in API mode: mock ids must never leak into real data).
 *  In API mode the persisted copy is also sanitized to backend-shaped
 *  ids so hybrid state can never reach the real backend. */
export function getLocalLibraryState(): PersistedLibrary {
  const persisted = loadPersistedLibrary();
  if (persisted) {
    return isApiMode
      ? {
          savedNotes: apiSafeIds(persisted.savedNotes),
          savedAlbums: apiSafeIds(persisted.savedAlbums),
          recents: apiSafeIds(persisted.recents) as RecentSeed[],
        }
      : persisted;
  }
  return isApiMode
    ? { savedNotes: [], savedAlbums: [], recents: [] }
    : { savedNotes: [...initialSavedNotes], savedAlbums: [...initialSavedAlbums], recents: [...initialRecents] };
}

/** Persist the whole local library state (callers own the arrays). */
export function persistLocalLibraryState(state: PersistedLibrary): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — persistence is best-effort
  }
}

/* ----- session-local mutable state (hydrated from the session) ----- */

const initialLibrary = getLocalLibraryState();
let savedNotes: SavedItem[] = initialLibrary.savedNotes;
let savedAlbums: SavedItem[] = initialLibrary.savedAlbums;
let recents: RecentSeed[] = initialLibrary.recents;

function persistLibrary(): void {
  persistLocalLibraryState({ savedNotes, savedAlbums, recents });
}

/** Re-hydrate the in-memory mock library from the session — logout must not
 *  leave the previous account's listening history in memory. */
export function resetLocalLibraryState(): void {
  const fresh = getLocalLibraryState();
  savedNotes = fresh.savedNotes;
  savedAlbums = fresh.savedAlbums;
  recents = fresh.recents;
}

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
    persistLibrary();
  },

  async removeSavedAlbum(albumId) {
    await delay(240);
    const i = savedAlbums.findIndex((s) => s.id === albumId);
    if (i >= 0) savedAlbums.splice(i, 1);
    persistLibrary();
  },

  async recordPlay(noteId) {
    await delay(120);
    const i = recents.findIndex((r) => r.id === noteId);
    if (i >= 0) recents.splice(i, 1);
    recents.unshift({ id: noteId, playedAt: Date.now(), progress: 0 });
    if (recents.length > 12) recents.length = 12;
    persistLibrary();
  },

  async recordProgress(noteId, progress) {
    await delay(100);
    const i = recents.findIndex((r) => r.id === noteId);
    if (i >= 0) recents.splice(i, 1);
    recents.unshift({
      id: noteId,
      playedAt: Date.now(),
      progress: Math.min(1, Math.max(0, progress)),
    });
    if (recents.length > 12) recents.length = 12;
    persistLibrary();
  },

  async clearRecentlyPlayed() {
    await delay(240);
    recents.length = 0;
    persistLibrary();
  },
};

/** Single access point — mode switch lives here. */
export function createLibraryRepository(): LibraryRepository {
  return isApiMode ? httpLibraryModule.httpLibraryRepository : mockLibraryRepository;
}

/** Drop per-user library memory on logout (mode-aware). */
export function resetLibraryRepository(): void {
  resetLocalLibraryState();
  if (isApiMode) httpLibraryModule.resetHttpLibraryState();
}
