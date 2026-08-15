/* ============================================================
   HTTP VoiceNote repository (Phase 18, API mode).

   Maps the backend VoiceNote API onto the frontend's existing
   VoiceNoteRepository interface:

     GET  /api/vns/feed?limit=          public feed (featured/trending/newest)
     GET  /api/vns/:id                  single (auth-aware visibility)
     POST /api/vns/:id/like             like
     DELETE /api/vns/:id/like           unlike

   Backend notes carry `owner` instead of `creatorId`, no artwork
   and no plays — the shared mapper synthesizes those deterministically
   at this boundary. Recently played has no backend endpoint, so it
   resolves the local session history through the real API (transient
   UX state, never mixed with mock content).
   ============================================================ */

import type { VoiceNote } from '../../data/types';
import type { VoiceNoteRepository } from '../voiceNoteRepository';
import type { CreatorProfile } from '../creatorRepository';
import { apiRequest } from './apiClient';
import {
  mapAlbumSummary,
  mapCreator,
  mapVoiceNote,
  type BackendAlbum,
  type BackendUser,
  type BackendVoiceNote,
} from './mappers';
import { isAuthenticated } from './session';
import { cacheActor } from './identity';

const FEED_LIMIT = 40;

interface Paginated {
  voiceNotes?: BackendVoiceNote[];
  items?: BackendVoiceNote[];
}

/** Cache every note's real owner into the cross-mode identity cache so
 *  UI cards resolve backend usernames instead of mock fallbacks. */
function cacheOwners(notes: BackendVoiceNote[]): void {
  for (const n of notes) {
    if (n.owner?.id) {
      cacheActor(n.owner.id, {
        name: n.owner.username,
        handle: n.owner.username,
        avatar: n.owner.avatar ?? '',
      });
    }
  }
}

async function getFeed(): Promise<BackendVoiceNote[]> {
  const data = await apiRequest<Paginated>('/vns/feed', { query: { limit: FEED_LIMIT } });
  const notes = data.voiceNotes ?? data.items ?? [];
  cacheOwners(notes);
  return notes;
}

/** Local recently-played ids (the session-persisted history the library
 *  repository uses) — resolved through the real API by id.
 *  Only backend-shaped ids (Mongo ObjectIds: 24 hex chars) are considered
 *  in API mode — stale mock ids from mock-mode sessions are dropped so
 *  hybrid state can never hit the backend. */
function localRecentIds(): string[] {
  try {
    const raw = window.sessionStorage.getItem('vn.library.session.v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { recents?: { id: string }[] };
    const ids = Array.isArray(parsed.recents) ? parsed.recents.map((r) => r.id) : [];
    return ids.filter((id) => /^[0-9a-f]{24}$/.test(id));
  } catch {
    return [];
  }
}

export const httpVoiceNoteRepository: VoiceNoteRepository = {
  async getFeatured() {
    const feed = await getFeed();
    return feed.slice(0, 4).map(mapVoiceNote);
  },

  async getTrending() {
    const feed = await getFeed();
    return feed.slice(0, 6).map(mapVoiceNote);
  },

  async getNewest() {
    const feed = await getFeed();
    return feed.slice(0, 6).map(mapVoiceNote);
  },

  async getRecentlyPlayed() {
    const ids = localRecentIds();
    if (ids.length === 0) return [];
    const notes = await Promise.all(
      ids.slice(0, 8).map(async (id) => {
        try {
          const data = await apiRequest<{ voiceNote: BackendVoiceNote }>(`/vns/${id}`);
          return data.voiceNote ? mapVoiceNote(data.voiceNote) : null;
        } catch {
          return null;
        }
      }),
    );
    return notes.filter((n): n is VoiceNote => Boolean(n));
  },

  async getById(id) {
    try {
      const data = await apiRequest<{ voiceNote: BackendVoiceNote }>(`/vns/${id}`);
      return data.voiceNote ? mapVoiceNote(data.voiceNote) : null;
    } catch {
      return null;
    }
  },

  async getRelated(note, limit = 4) {
    const feed = await getFeed();
    return feed
      .filter((v) => v.id !== note.id)
      .slice(0, limit)
      .map(mapVoiceNote);
  },

  async getByCreatorHandle(handle) {
    const data = await apiRequest<{ voiceNotes?: BackendVoiceNote[]; items?: BackendVoiceNote[] }>(
      `/users/${encodeURIComponent(handle)}/voice-notes`,
      { query: { limit: 50 }, auth: isAuthenticated() },
    );
    const notes = data.voiceNotes ?? data.items ?? [];
    cacheOwners(notes);
    return notes.map(mapVoiceNote);
  },

  async getCreators() {
    const feed = await getFeed();
    const owners = uniqueOwners(feed);
    const creators = await Promise.all(
      owners.slice(0, 12).map((owner) => fetchCreatorProfile(owner)),
    );
    return creators.filter((c): c is CreatorProfile => Boolean(c));
  },

  async getAlbums() {
    const data = await apiRequest<{ albums?: BackendAlbum[] }>('/albums/discover', {
      query: { limit: FEED_LIMIT },
    });
    return (data.albums ?? []).map(mapAlbumSummary);
  },

  async likeVoiceNote(noteId) {
    await apiRequest(`/vns/${noteId}/like`, { method: 'POST' });
  },

  async unlikeVoiceNote(noteId) {
    await apiRequest(`/vns/${noteId}/like`, { method: 'DELETE' });
  },
};

function uniqueOwners(notes: BackendVoiceNote[]): Array<{ id?: string; username?: string }> {
  const seen = new Set<string>();
  const owners: Array<{ id?: string; username?: string }> = [];
  for (const n of notes) {
    const owner = n.owner ?? { id: n.ownerId ?? '', username: n.ownerId ?? 'unknown' };
    if (owner.id && !seen.has(owner.id)) {
      seen.add(owner.id);
      owners.push(owner);
    }
  }
  return owners;
}

/** Full profile (stats + follow relationship) for a backend user.
 *  The public-profile endpoint is keyed by USERNAME (the follow
 *  endpoint uses the id) — pass the owner DTO so callers always
 *  have both. Falls back to id when a handle isn't available. */
export async function fetchCreatorProfile(owner: {
  id?: string;
  username?: string;
}): Promise<CreatorProfile | null> {
  const key = owner.username ?? owner.id;
  if (!key) return null;
  try {
    const data = await apiRequest<{
      user: BackendUser;
      stats?: { publicVoiceNotes?: number; publicAlbums?: number; followers?: number; following?: number };
      relationship?: { isFollowing: boolean };
    }>(`/users/${encodeURIComponent(key)}`, { auth: isAuthenticated() });
    return mapCreator(
      data.user,
      {
        followers: data.stats?.followers,
        following: data.stats?.following,
        publicVoiceNotes: data.stats?.publicVoiceNotes,
        publicAlbums: data.stats?.publicAlbums,
      },
      data.relationship,
    );
  } catch {
    return null;
  }
}
