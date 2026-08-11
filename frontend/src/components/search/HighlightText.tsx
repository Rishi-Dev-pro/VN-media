import type { ReactNode } from 'react';

/** Wrap the first case-insensitive match of `query` in a subtle mark. */
export function highlight(text: string, query: string): ReactNode {
  const q = query.trim().replace(/^[#@]+/, '').toLowerCase();
  const t = text.toLowerCase();
  if (!q) return text;
  const idx = t.indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="hl">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/** Handles a list (e.g. tags) — used for tag chips. */
export function highlightTag(name: string, query: string): ReactNode {
  return highlight(name, query);
}
