/* ============================================================
   HTTP following repository (Phase 18, API mode).

   The server owns the follow graph:

     GET /api/vns/feed/following     personalized feed (server follows)
     GET /api/users/:me/following    the followed creators (rail)

   The `followedIds` argument passed by the hook is ignored — the
   backend is authoritative. `creators` is the union of followed
   creators and other public feed owners (so the "You may like"
   recommendations still derive from real data, never mock).
   ============================================================ */

import type { VoiceNote } from '../../data/types';
import type { FollowingCreator, FollowingFeed, FollowingRepository } from '../followingRepository';
import { apiRequest } from './apiClient';
import {
  mapCreator,
  mapVoiceNote,
  pickTint,
  type BackendUser,
  type BackendVoiceNote,
} from './mappers';
import { fetchCreatorProfile } from './httpVoiceNoteRepository';
import { getCurrentUserId } from './session';

const WEEK = 7 * 24 * 60 * 60 * 1000;

export const httpFollowingRepository: FollowingRepository = {
  async getFollowingFeed() {
    const me = getCurrentUserId();
    if (!me) {
      throw new Error('Authentication required');
    }

    // 1) the personalized feed — server-side follow resolution
    const feed = await apiRequest<{ items?: BackendVoiceNote[] }>('/vns/feed/following', {
      query: { limit: 40 },
    });
    const notes = (feed.items ?? []).map(mapVoiceNote);

    // 2) the followed creators (rail)
    const followingData = await apiRequest<{ following?: BackendUser[] }>(
      `/users/${encodeURIComponent(me)}/following`,
      { query: { limit: 100 } },
    );
    const followedUsers = followingData.following ?? [];

    // 3) other feed owners → recommendations (real profiles, not followed)
    const followedIds = new Set(followedUsers.map((u) => u.id));
    const otherOwnerIds: string[] = [];
    const seen = new Set(followedIds);
    for (const n of feed.items ?? []) {
      const id = n.owner?.id ?? n.ownerId;
      if (id && !seen.has(id)) {
        seen.add(id);
        otherOwnerIds.push(id);
      }
    }

    const [followedCreators, otherCreators] = await Promise.all([
      Promise.all(
        followedUsers.slice(0, 12).map(async (u) => {
          const latest = notes.find((n) => n.creatorId === u.id) ?? null;
          return toRailCreator(u, latest);
        }),
      ),
      Promise.all(
        otherOwnerIds.slice(0, 8).map(async (id) => {
          const profile = await fetchCreatorProfile({ id });
          if (!profile) return null;
          const latest = notes.find((n) => n.creatorId === id) ?? null;
          return {
            id: profile.id,
            handle: profile.handle,
            name: profile.name,
            avatar: profile.avatar,
            bio: profile.bio,
            tint: profile.tint,
            followers: profile.followers,
            latestNote: latest,
          } satisfies FollowingCreator;
        }),
      ),
    ]);

    const creators = [...followedCreators, ...otherCreators.filter((c): c is FollowingCreator => Boolean(c))];

    const now = Date.now();
    const newThisWeek = notes.filter((n) => now - +new Date(n.releasedAt) <= WEEK).length;

    return { creators, notes, newThisWeek } satisfies FollowingFeed;
  },
};

function toRailCreator(u: BackendUser, latestNote: VoiceNote | null): FollowingCreator {
  const base = mapCreator(u);
  return {
    id: base.id,
    handle: base.handle,
    name: base.name,
    avatar: base.avatar,
    bio: base.bio,
    tint: pickTint(base.id),
    followers: base.followers,
    latestNote,
  };
}
