import type { Album, VoiceNote } from '../data/types';
import { mockAlbums, albumsById } from '../data/mockAlbums';
import { mockCreators } from '../data/mockCreators';
import { voiceNotesById } from '../data/mockVoiceNotes';

/* ============================================================
   Repository boundary.

   The UI talks to this interface only. Today it is backed by
   the mock implementation below; in the integration phase an
   `HttpAlbumRepository` will implement the same interface
   against the real VN-Media API — no component changes needed.
   ============================================================ */

/** Lightweight album row for grids and rails. */
export interface AlbumSummary {
  id: string;
  title: string;
  creatorId: string;
  creatorHandle: string;
  creatorName: string;
  creatorAvatar: string;
  description: string;
  cover: string;
  year: number;
  /** ids of the underlying VoiceNotes (for playback queues) */
  voiceNoteIds: string[];
  trackCount: number;
  /** total duration across tracks, in seconds */
  totalDuration: number;
  featured?: boolean;
  visibility: 'public' | 'followers';
}

/** Full album view: summary + resolved track list for playback. */
export interface AlbumDetail extends AlbumSummary {
  tracks: VoiceNote[];
  /** aggregate plays + likes + comments across tracks */
  plays: number;
  likes: number;
  comments: number;
}

export interface AlbumRepository {
  getAlbums(): Promise<AlbumSummary[]>;
  getFeatured(): Promise<AlbumSummary | null>;
  getById(id: string): Promise<AlbumDetail | null>;
  getRelated(albumId: string, limit?: number): Promise<AlbumSummary[]>;
}

/** Simulated network latency so loading states are real. */
const delay = (ms = 640) => new Promise<void>((r) => setTimeout(r, ms));

function summarize(album: Album): AlbumSummary {
  const creator = mockCreators.find((c) => c.id === album.creatorId) ?? mockCreators[0];
  const tracks = album.voiceNoteIds
    .map((id) => voiceNotesById[id])
    .filter(Boolean) as VoiceNote[];
  return {
    id: album.id,
    title: album.title,
    creatorId: album.creatorId,
    creatorHandle: creator.handle,
    creatorName: creator.name,
    creatorAvatar: creator.avatar,
    description: album.description,
    cover: album.cover,
    year: album.year,
    voiceNoteIds: album.voiceNoteIds,
    trackCount: tracks.length,
    totalDuration: tracks.reduce((sum, t) => sum + t.duration, 0),
    featured: album.featured,
    visibility: album.visibility ?? 'public',
  };
}

function detail(album: Album): AlbumDetail {
  const summary = summarize(album);
  const tracks = album.voiceNoteIds
    .map((id) => voiceNotesById[id])
    .filter(Boolean) as VoiceNote[];
  return {
    ...summary,
    tracks,
    plays: tracks.reduce((s, t) => s + t.plays, 0),
    likes: tracks.reduce((s, t) => s + t.likes, 0),
    comments: tracks.reduce((s, t) => s + t.comments, 0),
  };
}

export const mockAlbumRepository: AlbumRepository = {
  async getAlbums() {
    await delay();
    return mockAlbums.map(summarize);
  },

  async getFeatured() {
    await delay(540);
    const featured = mockAlbums.find((a) => a.featured);
    return featured ? summarize(featured) : null;
  },

  async getById(id) {
    await delay(520);
    const album = albumsById[id];
    return album ? detail(album) : null;
  },

  async getRelated(albumId, limit = 4) {
    await delay(380);
    const album = albumsById[albumId];
    if (!album) return [];
    const rest = mockAlbums.filter((a) => a.id !== album.id);
    // same creator first, then the rest — stable and deterministic
    const ordered = [
      ...rest.filter((a) => a.creatorId === album.creatorId),
      ...rest.filter((a) => a.creatorId !== album.creatorId),
    ];
    return ordered.slice(0, limit).map(summarize);
  },
};

/** Single access point — the integration phase swaps the impl here. */
export function createAlbumRepository(): AlbumRepository {
  return mockAlbumRepository;
}
