/**
 * Deterministic pseudo-random waveform (mulberry32).
 * Same seed → same bars, every load. Used for mock audio
 * messages so the UI never depends on real audio files.
 */
export function seededWave(seed: number, bars = 30): number[] {
  let a = seed >>> 0;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: number[] = [];
  let prev = 0.4;
  for (let i = 0; i < bars; i++) {
    const v = Math.max(0.08, Math.min(1, prev + (rand() - 0.5) * 0.7));
    prev = v;
    out.push(v);
  }
  return out;
}
