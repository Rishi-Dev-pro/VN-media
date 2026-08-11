/** 222 -> "03:42" */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** 2850 -> "48 min", 4310 -> "1 hr 12 min" */
export function formatMinutes(totalSeconds: number): string {
  const m = Math.max(0, Math.round(totalSeconds / 60));
  if (m < 60) return `${m} min`;
  const hr = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${hr} hr` : `${hr} hr ${r} min`;
}

/** 12800 -> "12.8k", 48200 -> "48.2k", 153000 -> "153k" */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** 2026-08-05T21:15:00Z -> "Aug 5" */
export function formatReleaseDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * 2026-08-11T07:30:00Z -> "4 hr ago" / "Yesterday" / "3 days ago" / "Aug 3".
 * `now` can be supplied so mock feeds stay deterministic.
 */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  return formatReleaseDate(iso);
}
