import type { Creator } from '../data/types';
import { mockAlbums } from '../data/mockAlbums';
import { mockCreators, creatorsById, SELF_CREATOR_ID } from '../data/mockCreators';
import { notesByCreator } from '../data/mockFollowing';
import { createAuthRepository } from './authRepository';
import { isApiMode } from './api/apiConfig';
import { httpCreatorRepository } from './api/httpCreatorRepository';

/* ============================================================
   Repository boundary.

   The UI talks to this interface only. Today it is backed by
   the mock implementation below; in the integration phase an
   `HttpCreatorRepository` will implement the same interface
   against the real VN-Media API — no component changes needed.
   ============================================================ */

/** A creator plus content counts derived from the shared catalog. */
export interface CreatorProfile extends Creator {
  /** public VoiceNotes by this creator */
  voiceNoteCount: number;
  /** public albums by this creator */
  albumCount: number;
  /** aggregate plays across their public VoiceNotes (trending proxy) */
  totalPlays: number;
  /** follow relationship for the requesting user (API mode) */
  relationship?: { isFollowing: boolean };
}

export interface CreatorRepository {
  getCreators(): Promise<CreatorProfile[]>;
  getFeatured(): Promise<CreatorProfile | null>;
  getByUsername(handle: string): Promise<CreatorProfile | null>;
  searchCreators(query: string): Promise<CreatorProfile[]>;
}

/** Simulated network latency so loading states are real. */
const delay = (ms = 640) => new Promise<void>((r) => setTimeout(r, ms));

/** Derive counts from the shared VoiceNote / Album catalogs (public only). */
function profile(c: Creator): CreatorProfile {
  const notes = notesByCreator(c.id);
  return {
    ...c,
    voiceNoteCount: notes.length,
    albumCount: mockAlbums.filter(
      (a) => a.creatorId === c.id && (a.visibility ?? 'public') === 'public',
    ).length,
    totalPlays: notes.reduce((sum, n) => sum + n.plays, 0),
  };
}

const isSelf = (c: Creator) => c.id === SELF_CREATOR_ID;

/**
 * The current user's creator identity mirrors the editable /profile
 * state (handle, name, avatar, bio) so the studio and the public
 * profile page stay one person.
 */
async function selfProfile(): Promise<CreatorProfile | null> {
  const auth = await createAuthRepository().getCurrentUser().catch(() => null);
  if (!auth) return null;
  const base = mockCreators.find(isSelf);
  if (!base) return null;
  return profile({
    ...base,
    name: auth.name,
    handle: auth.handle,
    avatar: auth.avatar,
    bio: auth.bio ?? base.bio,
  });
}

export const mockCreatorRepository: CreatorRepository = {
  async getCreators() {
    await delay();
    // the current user's own room isn't listed among "discoverable creators"
    return mockCreators.filter((c) => !isSelf(c)).map(profile);
  },

  async getFeatured() {
    await delay(540);
    const featured = mockCreators.find((c) => c.featured && !isSelf(c));
    return featured ? profile(featured) : null;
  },

  async getByUsername(handle) {
    await delay(520);
    const self = await selfProfile();
    if (self && self.handle === handle) return self;
    const creator = mockCreators.find((c) => c.handle === handle && !isSelf(c));
    return creator ? profile(creator) : null;
  },

  async searchCreators(query) {
    await delay(380);
    const q = query.trim().toLowerCase();
    if (!q) return mockCreators.filter((c) => !isSelf(c)).map(profile);
    return mockCreators
      .filter((c) => !isSelf(c))
      .filter(
        (c) =>
          c.handle.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.bio.toLowerCase().includes(q),
      )
      .map(profile);
  },
};

/** Single access point — mode switch lives here. */
export function createCreatorRepository(): CreatorRepository {
  return isApiMode ? httpCreatorRepository : mockCreatorRepository;
}

/** Look up the base creator by id (fallback used by other surfaces). */
export function creatorById(id: string): Creator | undefined {
  return creatorsById[id];
}
