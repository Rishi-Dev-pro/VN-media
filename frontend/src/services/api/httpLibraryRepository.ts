/* ============================================================
   HTTP library repository (Phase 18, API mode).

   The backend has no personal-library API, so the Library page's
   saved notes / saved albums / recently played remain TRANSIENT
   LOCAL UX state (sessionStorage, same shape as mock mode) — but
   every id is resolved through the real backend (GET /api/vns/:id,
   GET /api/albums/:id) so identities are always real. Mock ids
   never enter the picture: in API mode the local seed is empty.

   This is documented UX state, not a second source of truth —
   the server catalog is authoritative for the content itself.
   ============================================================ */

import type { VoiceNote } from '../../data/types';
import type { AlbumSummary } from '../albumRepository';
import type { LibraryData, LibraryRepository, RecentEntry } from '../libraryRepository';
import {
  getLocalLibraryState,
  persistLocalLibraryState,
  type PersistedLibrary,
} from '../libraryRepository';
import { apiRequest } from './apiClient';
import { mapAlbumSummary, mapVoiceNote, type BackendAlbum, type BackendVoiceNote } from './mappers';
import { cacheNotes } from './identity';

// Lazily hydrated on first access — this module is imported (circularly)
// from libraryRepository.ts, whose seed consts are not yet initialized at
// module-eval time. Deferring the read keeps that cycle safe.
let state: PersistedLibrary | null = null;
function getState(): PersistedLibrary {
  if (!state) state = getLocalLibraryState();
  return state;
}

/** Re-hydrate from the session after logout — in-memory library state must
 *  never survive into a different account's session. */
export function resetHttpLibraryState(): void {
  state = getLocalLibraryState();
}

function persist(): void {
  persistLocalLibraryState(getState());
}

async function resolveNote(id: string): Promise<VoiceNote | null> {
  try {
    const data = await apiRequest<{ voiceNote: BackendVoiceNote }>(`/vns/${id}`);
    if (!data.voiceNote) return null;
    const note = mapVoiceNote(data.voiceNote);
    cacheNotes([note]);
    return note;
  } catch {
    return null;
  }
}

async function resolveAlbum(id: string): Promise<AlbumSummary | null> {
  try {
    const data = await apiRequest<{ album: BackendAlbum }>(`/albums/${id}`);
    return data.album ? mapAlbumSummary(data.album) : null;
  } catch {
    return null;
  }
}

export const httpLibraryRepository: LibraryRepository = {
  async getLibrary() {
    const s = getState();
    const notes = (
      await Promise.all(s.savedNotes.map((n) => resolveNote(n.id)))
    ).filter((n): n is VoiceNote => Boolean(n));

    const albums = (
      await Promise.all(s.savedAlbums.map((a) => resolveAlbum(a.id)))
    ).filter((a): a is AlbumSummary => Boolean(a));

    const recents = (
      await Promise.all(
        s.recents.map(async (r) => {
          const note = await resolveNote(r.id);
          return note ? { note, playedAt: r.playedAt, progress: r.progress } : null;
        }),
      )
    ).filter((r): r is RecentEntry => Boolean(r));

    return { savedNotes: notes, savedAlbums: albums, recents } satisfies LibraryData;
  },

  async getNotesByIds(ids) {
    const notes = (await Promise.all(ids.map((id) => resolveNote(id)))).filter(
      (n): n is VoiceNote => Boolean(n),
    );
    return notes;
  },

  async removeSavedNote(noteId) {
    const s = getState();
    const i = s.savedNotes.findIndex((x) => x.id === noteId);
    if (i >= 0) s.savedNotes.splice(i, 1);
    persist();
  },

  async removeSavedAlbum(albumId) {
    const s = getState();
    const i = s.savedAlbums.findIndex((x) => x.id === albumId);
    if (i >= 0) s.savedAlbums.splice(i, 1);
    persist();
  },

  async recordPlay(noteId) {
    const s = getState();
    const i = s.recents.findIndex((r) => r.id === noteId);
    if (i >= 0) s.recents.splice(i, 1);
    s.recents.unshift({ id: noteId, playedAt: Date.now(), progress: 0 });
    if (s.recents.length > 12) s.recents.length = 12;
    persist();
  },

  async recordProgress(noteId, progress) {
    const s = getState();
    const i = s.recents.findIndex((r) => r.id === noteId);
    if (i >= 0) s.recents.splice(i, 1);
    s.recents.unshift({
      id: noteId,
      playedAt: Date.now(),
      progress: Math.min(1, Math.max(0, progress)),
    });
    if (s.recents.length > 12) s.recents.length = 12;
    persist();
  },

  async clearRecentlyPlayed() {
    getState().recents.length = 0;
    persist();
  },
};
