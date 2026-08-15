/* ============================================================
   Cross-mode identity resolution (Phase 18).

   Components used to resolve actor / note identities straight from
   the mock catalog (`mockCreators`, `voiceNotesById`). In API mode
   ids are backend ObjectIds, so every such lookup must go through
   this boundary:

     - mock mode: exact catalog lookup (unchanged behavior)
     - api mode:  a cache filled by real API fetches, with a safe
                  deterministic fallback so the UI NEVER crashes on
                  an unknown id and never renders mock entities.

   `relativeNow()` picks the correct "now" for relative timestamps
   (fixed DEMO_NOW anchor in mock mode, real clock in API mode).
   ============================================================ */

import type { Creator, VoiceNote } from '../../data/types';
import { isApiMode } from './apiConfig';
import { getCreator as mockGetCreator } from '../../data/mockCreators';
import { voiceNotesById as mockVoiceNotesById } from '../../data/mockVoiceNotes';
import { DEMO_LISTENER, DEMO_NOW } from '../../data/mockFollowing';
import { getSessionUser } from './session';
import { pickArt, pickAvatar, pickTint } from './mappers';

/** id → { name, handle, avatar } — populated by API fetches. */
const actorCache = new Map<string, { name: string; handle: string; avatar: string }>();
/** id → VoiceNote — populated by API fetches. */
const noteCache = new Map<string, VoiceNote>();

export function cacheActor(id: string, actor: { name: string; handle: string; avatar: string }): void {
  actorCache.set(id, actor);
}

export function cacheNote(note: VoiceNote): void {
  noteCache.set(note.id, note);
}

export function cacheNotes(notes: VoiceNote[]): void {
  for (const n of notes) cacheNote(n);
}

/** Never throws — unknown ids get a deterministic fallback identity. */
export function resolveCreatorSync(id: string): { name: string; handle: string; avatar: string } {
  if (!isApiMode) {
    const creator = mockGetCreator(id);
    return creator
      ? { name: creator.name, handle: creator.handle, avatar: creator.avatar }
      : { name: 'VN-Media', handle: 'vn', avatar: pickAvatar('fallback') };
  }
  const cached = actorCache.get(id);
  if (cached) return cached;
  return { name: id.slice(-6) || 'creator', handle: id, avatar: pickAvatar(id) };
}

/**
 * Mode-aware Creator lookup for UI cards (FeedCard, TrackRow, player
 * surfaces, comments, search…). In mock mode this is the exact mock
 * catalog lookup — in API mode it resolves the real cached actor or a
 * deterministic fallback, and NEVER returns a mock creator for an
 * unknown backend id (prevents hybrid mock/real leakage).
 */
export function getCreatorSafe(id: string): Creator {
  if (!isApiMode) {
    return mockGetCreator(id);
  }
  const cached = actorCache.get(id);
  if (cached) {
    return {
      id,
      handle: cached.handle,
      name: cached.name,
      avatar: cached.avatar || pickAvatar(id),
      bio: '',
      followers: 0,
      following: 0,
      tags: [],
      joinedAt: new Date().toISOString(),
      tint: pickTint(id),
    };
  }
  // Deterministic real-mode fallback — the id IS the identity, never mock.
  return {
    id,
    handle: id.slice(-10) || 'creator',
    name: id.slice(-10) || 'Creator',
    avatar: pickAvatar(id),
    bio: '',
    followers: 0,
    following: 0,
    tags: [],
    joinedAt: new Date().toISOString(),
    tint: pickTint(id),
  };
}

/** Never throws — unknown notes fall back to deterministic artwork. */
export function resolveNoteSync(id: string | undefined): VoiceNote | undefined {
  if (!id) return undefined;
  if (!isApiMode) return mockVoiceNotesById[id];
  const cached = noteCache.get(id);
  if (cached) return cached;
  return undefined;
}

/** The current listener's identity — mock mode: the demo listener;
 *  API mode: the real authenticated session user (never mock). */
export function getListener(): { handle: string; name: string; avatar: string } {
  if (!isApiMode) {
    return { handle: DEMO_LISTENER.handle, name: DEMO_LISTENER.name, avatar: DEMO_LISTENER.avatar };
  }
  const user = getSessionUser();
  if (user) {
    return {
      handle: user.username,
      name: user.username,
      avatar: user.avatar ?? pickAvatar(user.id),
    };
  }
  return { handle: 'guest', name: 'Guest', avatar: pickAvatar('guest') };
}

/** The correct "now" anchor for relative timestamps. */
export function relativeNow(): number {
  return isApiMode ? Date.now() : DEMO_NOW;
}

/** Safe note artwork for a known id (no crash on unknown). */
export function artworkFor(id: string | undefined): string {
  if (!id) return '/images/headphones-dark.jpg';
  return resolveNoteSync(id)?.cover ?? pickArt(id);
}
