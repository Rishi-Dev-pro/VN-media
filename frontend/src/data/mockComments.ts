import { mockCreators } from './mockCreators';
import { DEMO_NOW } from './mockFollowing';

/* ============================================================
   Mock comments (UI-only demo).

   Comments are generated deterministically from the VoiceNote id
   so the same note always shows the same thread — no randomness.
   In the integration phase this file is replaced by the real
   comments endpoint via the repository layer.
   ============================================================ */

export interface MockComment {
  id: string;
  authorName: string;
  authorHandle: string;
  avatar: string;
  text: string;
  /** ISO date */
  createdAt: string;
  likes: number;
  /** lightweight reply indicator for flavor */
  replies: number;
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
 * between the note's release and DEMO_NOW.
 */
export function getMockComments(noteId: string, releasedAt: string): MockComment[] {
  const seed = hash(noteId);
  const count = 3 + (seed % 5); // 3–7 comments
  const release = +new Date(releasedAt);
  // spread the thread across the whole release→now window so even
  // freshly-published notes get believable relative timestamps
  const windowMs = Math.max(DEMO_NOW - release, 60_000);
  const comments: MockComment[] = [];

  for (let i = 0; i < count; i += 1) {
    const creator = mockCreators[pick(seed, i, mockCreators.length)];
    // newest comment is closest to "now"; deterministic jitter keeps order
    const frac = (count - i) / (count + 1);
    const jitter = (pick(seed, i + 3, 5) - 2) / 12; // ±0.16
    const ts = Math.min(release + windowMs * Math.min(0.95, Math.max(0.05, frac + jitter)), DEMO_NOW);

    comments.push({
      id: `${noteId}-c${i}`,
      authorName: creator.name,
      authorHandle: creator.handle,
      avatar: creator.avatar,
      text: POOL[pick(seed, i + 1, POOL.length)],
      createdAt: new Date(ts).toISOString(),
      likes: pick(seed, i + 5, 60) + 1,
      replies: pick(seed, i + 7, 4),
    });
  }

  return comments.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}
