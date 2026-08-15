/* ============================================================
   Deterministic pseudo-random helpers.

   Shuffle must be reproducible for the same session/input — the
   playback queue must not depend on Math.random(). These helpers
   produce stable output from a seed, so the same queue + seed
   always yields the same order.
   ============================================================ */

/** Mulberry32 — tiny, fast, seeded PRNG returning 0..1. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable string hash — seeds the shuffle from queue identity. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher–Yates with the seeded PRNG. Returns a new array. */
export function seededShuffle<T>(input: readonly T[], seed: number): T[] {
  const arr = [...input];
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
