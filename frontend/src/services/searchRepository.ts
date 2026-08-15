import type { Album, Creator, Tag, VoiceNote } from '../data/types';
import { mockAlbums } from '../data/mockAlbums';
import { mockCreators } from '../data/mockCreators';
import { mockTagCatalog } from '../data/mockTags';
import { mockVoiceNotes } from '../data/mockVoiceNotes';
import { isApiMode } from './api/apiConfig';
import { httpSearchRepository } from './api/httpSearchRepository';

/* ============================================================
   Search repository boundary.

   The UI talks to this interface only. Today it is backed by the
   local mock implementation below; in the integration phase a
   `HttpSearchRepository` will implement the same interface against
   the real VN-Media API — no component changes needed.

   Matching is plain case-insensitive substring search (no unsafe
   dynamic regex), with deterministic ranking + tie-breakers.
   ============================================================ */

export type SearchFilter = 'all' | 'voiceNotes' | 'creators' | 'albums' | 'tags';

export interface SearchResults {
  voiceNotes: VoiceNote[];
  creators: Creator[];
  albums: Album[];
  tags: Tag[];
  /** count across all categories (used by the ALL tab header) */
  total: number;
}

export interface SearchRepository {
  search(query: string, filter: SearchFilter): Promise<SearchResults>;
  /** compact top matches for the suggestion panel */
  suggest(query: string): Promise<SearchResults>;
}

/** Simulated latency — kept short so search feels instant. */
const delay = (ms = 260) => new Promise<void>((r) => setTimeout(r, ms));

/** Normalize a query: trim, lowercase, tolerate a leading # or @. */
export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/^[#@]+/, '').toLowerCase();
}

/* ---------- deterministic scoring ---------- */

/** 100 exact · 80 starts-with · 60 contains · 0 no match */
function scoreField(text: string, q: string): number {
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  return 0;
}

function bestScore(fields: string[], q: string, multiplier = 1): number {
  let best = 0;
  for (const f of fields) best = Math.max(best, scoreField(f, q));
  return best * multiplier;
}

function rankNotes(q: string): VoiceNote[] {
  // private VoiceNotes never appear in public search
  return mockVoiceNotes
    .filter((n) => (n.visibility ?? 'public') === 'public')
    .map((n) => {
      const creator = mockCreators.find((c) => c.id === n.creatorId);
      const score = Math.max(
        bestScore([n.title], q),
        bestScore([n.category], q, 0.7),
        bestScore([n.description], q, 0.45),
        bestScore(n.tags, q, 0.8),
        bestScore([creator?.name ?? '', creator?.handle ?? ''], q, 0.85),
      );
      return { n, score };
    })
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        +new Date(b.n.releasedAt) - +new Date(a.n.releasedAt),
    )
    .map((r) => r.n);
}

function rankCreators(q: string): Creator[] {
  return mockCreators
    .map((c) => {
      const score = Math.max(
        bestScore([c.name, c.handle], q),
        bestScore([c.bio], q, 0.5),
      );
      return { c, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.c.followers - a.c.followers)
    .map((r) => r.c);
}

function rankAlbums(q: string): Album[] {
  return mockAlbums
    .map((a) => {
      const creator = mockCreators.find((c) => c.id === a.creatorId);
      const score = Math.max(
        bestScore([a.title], q),
        bestScore([a.description], q, 0.45),
        bestScore([creator?.name ?? '', creator?.handle ?? ''], q, 0.85),
      );
      return { a, score };
    })
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score || x.a.title.localeCompare(y.a.title))
    .map((r) => r.a);
}

function rankTags(q: string): Tag[] {
  return mockTagCatalog
    .map((t) => ({ t, score: scoreField(t.name, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.t.count - a.t.count)
    .map((r) => r.t);
}

const EMPTY: SearchResults = { voiceNotes: [], creators: [], albums: [], tags: [], total: 0 };

export const mockSearchRepository: SearchRepository = {
  async search(query, filter) {
    await delay();

    if (typeof window !== 'undefined' && window.location.search.includes('demo=error')) {
      throw new Error('Mock search failed (demo)');
    }

    const q = normalizeQuery(query);
    if (!q) return EMPTY;

    const notes = rankNotes(q);
    const creators = rankCreators(q);
    const albums = rankAlbums(q);
    const tags = rankTags(q);

    if (filter === 'all') {
      return {
        voiceNotes: notes.slice(0, 6),
        creators: creators.slice(0, 4),
        albums: albums.slice(0, 4),
        tags: tags.slice(0, 8),
        total: notes.length + creators.length + albums.length + tags.length,
      };
    }
    if (filter === 'voiceNotes') return { ...EMPTY, voiceNotes: notes, total: notes.length };
    if (filter === 'creators') return { ...EMPTY, creators, total: creators.length };
    if (filter === 'albums') return { ...EMPTY, albums, total: albums.length };
    return { ...EMPTY, tags, total: tags.length };
  },

  async suggest(query) {
    await delay(90);
    const q = normalizeQuery(query);
    if (!q) return EMPTY;
    return {
      voiceNotes: rankNotes(q).slice(0, 3),
      creators: rankCreators(q).slice(0, 2),
      albums: [],
      tags: rankTags(q).slice(0, 2),
      total: 0,
    };
  },
};

/** Single access point — mode switch lives here. */
export function createSearchRepository(): SearchRepository {
  return isApiMode ? httpSearchRepository : mockSearchRepository;
}
