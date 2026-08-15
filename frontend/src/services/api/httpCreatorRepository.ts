/* ============================================================
   HTTP creator repository (Phase 18, API mode).

   The backend has no "list all creators" endpoint, so discovery is
   derived deterministically from REAL data: the unique owners of the
   public feed (and search results), enriched with their full public
   profile stats via GET /api/users/:username. No mock creators ever
   enter API mode.

     GET /api/vns/feed?limit=     → owner ids (creator catalog)
     GET /api/users/:username     → profile + stats + relationship
   ============================================================ */

import { apiRequest } from './apiClient';
import { mapCreator, type BackendUser, type BackendVoiceNote } from './mappers';
import { fetchCreatorProfile } from './httpVoiceNoteRepository';
import { isAuthenticated } from './session';
import type { CreatorProfile } from '../creatorRepository';

const FEED_LIMIT = 40;

interface ProfilePayload {
  user: BackendUser;
  stats?: {
    publicVoiceNotes?: number;
    publicAlbums?: number;
    followers?: number;
    following?: number;
  };
  relationship?: { isFollowing: boolean };
}

async function getFeedNotes(): Promise<BackendVoiceNote[]> {
  const feed = await apiRequest<{ voiceNotes?: BackendVoiceNote[]; items?: BackendVoiceNote[] }>(
    '/vns/feed',
    { query: { limit: FEED_LIMIT } },
  );
  return feed.voiceNotes ?? feed.items ?? [];
}

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

export const httpCreatorRepository = {
  async getCreators(): Promise<CreatorProfile[]> {
    const owners = uniqueOwners(await getFeedNotes());
    const creators = await Promise.all(owners.slice(0, 12).map((owner) => fetchCreatorProfile(owner)));
    return creators.filter((c): c is CreatorProfile => Boolean(c));
  },

  async getFeatured(): Promise<CreatorProfile | null> {
    const notes = await getFeedNotes();
    const first = notes.find((n) => n.owner?.id ?? n.ownerId);
    if (!first) return null;
    return fetchCreatorProfile(first.owner ?? { id: first.ownerId ?? '' });
  },

  async getByUsername(handle: string): Promise<CreatorProfile | null> {
    try {
      const data = await apiRequest<ProfilePayload>(`/users/${encodeURIComponent(handle)}`, {
        auth: isAuthenticated(),
      });
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
  },

  async searchCreators(query: string): Promise<CreatorProfile[]> {
    const q = query.trim();
    if (!q) return this.getCreators();
    const data = await apiRequest<{ items?: BackendVoiceNote[] }>('/vns/search', {
      query: { q, limit: 30 },
    });
    const owners = uniqueOwners(data.items ?? []);
    const creators = await Promise.all(owners.slice(0, 8).map((owner) => fetchCreatorProfile(owner)));
    return creators.filter((c): c is CreatorProfile => Boolean(c));
  },
};
