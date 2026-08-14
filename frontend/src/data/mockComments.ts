import { mockCreators, SELF_CREATOR_ID } from './mockCreators';
import { DEMO_NOW } from './mockFollowing';

/* ============================================================
   Mock comments (UI-only demo).

   Comments are generated deterministically from the VoiceNote id
   so the same note always shows the same thread — no randomness.
   Root comments carry threaded replies via `parentCommentId` so
   the UI can render real (collapsible) conversations.

   In the integration phase this file is replaced by the real
   comments endpoint via the repository layer.
   ============================================================ */

export interface MockComment {
  id: string;
  /** VoiceNote this comment belongs to */
  voiceNoteId: string;
  /** set for replies — links a child to its root comment */
  parentCommentId?: string;
  authorName: string;
  authorHandle: string;
  avatar: string;
  text: string;
  /** ISO date */
  createdAt: string;
  likes: number;
  /** soft-deleted comments keep their id + children but hide the text */
  status: 'active' | 'deleted';
}

const POOL = [
  'this got me through the night shift 🖤',
  'the silence around the middle is unreal',
  'adding this to my 2am loop immediately',
  'please do a part two',
  'this is the sound of my bedroom on a good night',
  'heard this three times in a row. no regrets.',
  'you captured exactly what it feels like',
  'the way this builds at the end…',
  'sending this to everyone I know',
  'first listen and I already have it saved',
  'this belongs on a rainy window playlist',
  'how do you even record something this quiet',
  'stopped mid-walk to replay the last minute',
  'comfort audio. certified.',
  'this one is going to live in my head rent free',
  'the faint room tone makes it feel so present',
];

const REPLY_POOL = [
  'came here to say this',
  'exactly. every time.',
  'the room tone though 👀',
  'been on repeat all day',
  'that ending lives in my head',
  'agree — this is the one',
  'okay okay, you convinced me',
  'real ones know',
  'saved it immediately after hearing it',
  'the mix on this is so clean',
];

/** Stable string hash — used only for deterministic selection. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic pseudo-random in [0, n) from a seed. */
function pick(seed: number, i: number, n: number): number {
  return ((seed >> ((i % 5) * 3)) + i * 7) % n;
}

/**
 * A believable thread for a VoiceNote. Comments always land
 * between the note's release and DEMO_NOW. Root comments are
 * returned newest-first; replies carry `parentCommentId` and are
 * grouped by the UI under their root.
 */
export function getMockComments(noteId: string, releasedAt: string): MockComment[] {
  const seed = hash(noteId);
  const count = 3 + (seed % 5); // 3–7 root comments
  // the demo listener never authors seeded comments — those belong
  // to other creators; the listener's own comments come from the repo
  const authorPool = mockCreators.filter((c) => c.id !== SELF_CREATOR_ID);
  const release = +new Date(releasedAt);
  // spread the thread across the whole release→now window so even
  // freshly-published notes get believable relative timestamps
  const windowMs = Math.max(DEMO_NOW - release, 60_000);
  const comments: MockComment[] = [];
  const rootTimes: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const creator = authorPool[pick(seed, i, authorPool.length)];
    // newest comment is closest to "now"; deterministic jitter keeps order
    const frac = (count - i) / (count + 1);
    const jitter = (pick(seed, i + 3, 5) - 2) / 12; // ±0.16
    const ts = Math.min(release + windowMs * Math.min(0.95, Math.max(0.05, frac + jitter)), DEMO_NOW);
    rootTimes.push(ts);

    const rootId = `${noteId}-c${i}`;
    comments.push({
      id: rootId,
      voiceNoteId: noteId,
      authorName: creator.name,
      authorHandle: creator.handle,
      avatar: creator.avatar,
      text: POOL[pick(seed, i + 1, POOL.length)],
      createdAt: new Date(ts).toISOString(),
      likes: pick(seed, i + 5, 60) + 1,
      status: 'active',
    });

    // 0–2 deterministic replies under some roots
    const replyCount = pick(seed, i + 7, 3);
    for (let r = 0; r < replyCount; r += 1) {
      const replier = authorPool[pick(seed, i + 11 + r, authorPool.length)];
      const replyTs = ts + ((r + 1) * windowMs) / (count * 6) + 4 * 60_000;
      comments.push({
        id: `${rootId}-r${r}`,
        voiceNoteId: noteId,
        parentCommentId: rootId,
        authorName: replier.name,
        authorHandle: replier.handle,
        avatar: replier.avatar,
        text: REPLY_POOL[pick(seed, i + 13 + r * 2, REPLY_POOL.length)],
        createdAt: new Date(Math.min(replyTs, DEMO_NOW)).toISOString(),
        likes: pick(seed, i + 17 + r, 25),
        status: 'active',
      });
    }
  }

  // newest-first; the UI groups replies under their root comment
  return comments.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}
