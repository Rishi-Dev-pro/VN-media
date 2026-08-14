import type { VoiceNote } from '../data/types';
import { DEMO_LISTENER, DEMO_NOW, initialFollowing, notesByCreator } from '../data/mockFollowing';
import { mockCreators } from '../data/mockCreators';
import { mockVoiceNotes } from '../data/mockVoiceNotes';

/* ============================================================
   Following repository boundary.

   The UI talks to this interface only. Today it is backed by the
   local mock implementation below; in the integration phase a
   `HttpFollowingRepository` will implement the same interface
   against the real VN-Media API — no component changes needed.

   No follow requests are sent anywhere.
   ============================================================ */

export interface FollowingFeed {
  /** creators the rail can show, in rail order */
  creators: FollowingCreator[];
  /** VoiceNotes from followed creators, newest first */
  notes: VoiceNote[];
  /** total notes by the followed creators */
  newThisWeek: number;
}

export interface FollowingCreator {
  id: string;
  handle: string;
  name: string;
  avatar: string;
  bio: string;
  tint: string;
  followers: number;
  /** newest VoiceNote from this creator (for the rail indicator) */
  latestNote: VoiceNote | null;
}

export interface FollowingRepository {
  getFollowingFeed(followedIds: string[]): Promise<FollowingFeed>;
}

/** Simulated network latency so loading states are real. */
const delay = (ms = 700) => new Promise<void>((r) => setTimeout(r, ms));

const WEEK = 7 * 24 * 60 * 60 * 1000;

export const mockFollowingRepository: FollowingRepository = {
  async getFollowingFeed(followedIds) {
    await delay();

    // Demo affordance: /following?demo=error exercises the error UI.
    if (typeof window !== 'undefined' && window.location.search.includes('demo=error')) {
      throw new Error('Mock feed failed (demo)');
    }

    const followed = new Set(followedIds);
    // the full known catalog — the rail shows followed creators, the
    // "You may like" section derives its suggestions from the rest
    const creators: FollowingCreator[] = mockCreators.map((c) => ({
      id: c.id,
      handle: c.handle,
      name: c.name,
      avatar: c.avatar,
      bio: c.bio,
      tint: c.tint,
      followers: c.followers,
      latestNote: notesByCreator(c.id)[0] ?? null,
    }));

    const notes = mockVoiceNotes
      .filter(
        (n) =>
          followed.has(n.creatorId) && (n.visibility ?? 'public') === 'public',
      )
      .sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt));

    const newThisWeek = notes.filter((n) => DEMO_NOW - +new Date(n.releasedAt) <= WEEK).length;

    return { creators, notes, newThisWeek };
  },
};

/** Single access point — the integration phase swaps the impl here. */
export function createFollowingRepository(): FollowingRepository {
  return mockFollowingRepository;
}

export { DEMO_LISTENER, DEMO_NOW, initialFollowing };
