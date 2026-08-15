/* ============================================================
   HTTP search repository (Phase 18, API mode).

   Search is server-side (never a browser-side catalog filter):

     GET /api/vns/search?q=      → { items: VoiceNote[] }
     GET /api/albums/search?q=   → { items: Album[] }

   Creators are derived from the unique owners of the VoiceNote
   search results (there is no creator-search endpoint), enriched
   with public profiles. Tags are aggregated deterministically
   from result tags. The `search`/`suggest` interface is preserved.
   ============================================================ */

import type { Creator, Tag } from '../../data/types';
import { normalizeQuery, type SearchRepository, type SearchResults } from '../searchRepository';
import { apiRequest } from './apiClient';
import { mapAlbumSummary, mapVoiceNote, type BackendAlbum, type BackendVoiceNote } from './mappers';
import { fetchCreatorProfile } from './httpVoiceNoteRepository';

const EMPTY: SearchResults = { voiceNotes: [], creators: [], albums: [], tags: [], total: 0 };

async function searchNotes(q: string, limit: number): Promise<BackendVoiceNote[]> {
  const data = await apiRequest<{ items?: BackendVoiceNote[] }>('/vns/search', {
    query: { q, limit },
  });
  return data.items ?? [];
}

async function searchAlbums(q: string, limit: number): Promise<BackendAlbum[]> {
  const data = await apiRequest<{ items?: BackendAlbum[] }>('/albums/search', {
    query: { q, limit },
  });
  return data.items ?? [];
}

async function searchCreators(q: string, limit: number): Promise<Creator[]> {
  const notes = await searchNotes(q, 30);
  const seen = new Set<string>();
  const creators: Creator[] = [];
  for (const n of notes) {
    const id = n.owner?.id ?? n.ownerId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const profile = await fetchCreatorProfile(n.owner ?? { id });
    if (profile) creators.push(profile);
    if (creators.length >= limit) break;
  }
  return creators;
}

function aggregateTags(notes: BackendVoiceNote[], limit: number): Tag[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    for (const t of n.tags ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export const httpSearchRepository: SearchRepository = {
  async search(query, filter) {
    const q = normalizeQuery(query);
    if (!q) return EMPTY;

    if (filter === 'voiceNotes') {
      const notes = (await searchNotes(q, 30)).map(mapVoiceNote);
      return { ...EMPTY, voiceNotes: notes, total: notes.length };
    }
    if (filter === 'creators') {
      const creators = await searchCreators(q, 12);
      return { ...EMPTY, creators, total: creators.length };
    }
    if (filter === 'albums') {
      const albums = (await searchAlbums(q, 30)).map(mapAlbumSummary);
      return { ...EMPTY, albums, total: albums.length };
    }
    if (filter === 'tags') {
      const tags = aggregateTags(await searchNotes(q, 30), 12);
      return { ...EMPTY, tags, total: tags.length };
    }

    // all — parallel, capped
    const [notes, albums, creators, tags] = await Promise.all([
      searchNotes(q, 12).then((n) => n.map(mapVoiceNote)),
      searchAlbums(q, 10).then((a) => a.map(mapAlbumSummary)),
      searchCreators(q, 6),
      searchNotes(q, 30).then((n) => aggregateTags(n, 8)),
    ]);
    return {
      voiceNotes: notes,
      creators,
      albums,
      tags,
      total: notes.length + creators.length + albums.length + tags.length,
    };
  },

  async suggest(query) {
    const q = normalizeQuery(query);
    if (!q) return EMPTY;
    const [notes, creators, tags] = await Promise.all([
      searchNotes(q, 6).then((n) => n.slice(0, 3).map(mapVoiceNote)),
      searchCreators(q, 2),
      searchNotes(q, 12).then((n) => aggregateTags(n, 3)),
    ]);
    return { voiceNotes: notes, creators, albums: [], tags, total: 0 };
  },
};

export { normalizeQuery };
