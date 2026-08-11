import { mockCreators } from './mockCreators';
import { mockVoiceNotes } from './mockVoiceNotes';

/* ============================================================
   Following graph (mock).

   The demo listener is @rishi. `initialFollowing` lists the
   creators they already follow; every other known creator is
   shown in the rail as a "Follow" suggestion. Following a new
   creator makes their VoiceNotes appear in the feed.

   All dates are anchored to DEMO_NOW so the feed reads as
   deterministic relative timestamps ("4 hr ago", "Yesterday"…)
   no matter when the app is actually opened.
   ============================================================ */

export const DEMO_LISTENER = {
  handle: 'rishi',
  name: 'Rishi',
  avatar: '/images/portrait-7.jpg',
};

/** Fixed "now" for the demo feed — 2026-08-11 12:00 UTC. */
export const DEMO_NOW = new Date('2026-08-11T12:00:00Z').getTime();

/** Creator ids the demo listener already follows. */
export const initialFollowing: string[] = [
  'crea-luna',
  'crea-kairo',
  'crea-marcus',
  'crea-ivy',
  'crea-elio',
  'crea-serein',
];

/** Order the creator rail is presented in (followed first). */
export const followingRailOrder: string[] = [
  'crea-luna',
  'crea-kairo',
  'crea-marcus',
  'crea-ivy',
  'crea-elio',
  'crea-serein',
  'crea-aria',
  'crea-nocturne',
];

/** All VoiceNotes from a given creator, newest first. */
export function notesByCreator(creatorId: string) {
  return mockVoiceNotes
    .filter((n) => n.creatorId === creatorId)
    .sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt));
}

/** Every creator the rail can show (a stable order, no random shuffling). */
export const allRailCreators = followingRailOrder
  .map((id) => mockCreators.find((c) => c.id === id))
  .filter((c): c is NonNullable<typeof c> => Boolean(c));

/** Deterministic demo anchor for relative timestamps. */
export { mockCreators };
