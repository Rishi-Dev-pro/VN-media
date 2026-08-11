import type { Creator } from '../data/types';
import { mockAlbums } from '../data/mockAlbums';
import { mockCreators, creatorsById } from '../data/mockCreators';
import { notesByCreator } from '../data/mockFollowing';

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

export const mockCreatorRepository: CreatorRepository = {
  async getCreators() {
    await delay();
    return mockCreators.map(profile);
  },

  async getFeatured() {
    await delay(540);
    const featured = mockCreators.find((c) => c.featured);
    return featured ? profile(featured) : null;
  },

  async getByUsername(handle) {
    await delay(520);
    const creator = mockCreators.find((c) => c.handle === handle);
    return creator ? profile(creator) : null;
  },

  async searchCreators(query) {
    await delay(380);
    const q = query.trim().toLowerCase();
    if (!q) return mockCreators.map(profile);
    return mockCreators
      .filter(
        (c) =>
          c.handle.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.bio.toLowerCase().includes(q),
      )
      .map(profile);
  },
};

/** Single access point — the integration phase swaps the impl here. */
export function createCreatorRepository(): CreatorRepository {
  return mockCreatorRepository;
}

/** Look up the base creator by id (fallback used by other surfaces). */
export function creatorById(id: string): Creator | undefined {
  return creatorsById[id];
}
