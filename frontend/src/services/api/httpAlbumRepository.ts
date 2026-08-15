/* ============================================================
   HTTP album repository (Phase 18, API mode).

     GET  /api/albums/discover     public collections
     GET  /api/albums/search?q=    album search
     GET  /api/albums              owner collections (auth)
     GET  /api/albums/:id          album + ordered items (auth-aware)

   Album items arrive as { id, position, voiceNote } where voiceNote
   is the enriched backend VoiceNote — mapped to the frontend's track
   list at this boundary.
   ============================================================ */

import type { VoiceNote } from '../../data/types';
import type { AlbumDetail, AlbumRepository } from '../albumRepository';
import { apiRequest } from './apiClient';
import {
  mapAlbumSummary,
  mapVoiceNote,
  type BackendAlbum,
  type BackendVoiceNote,
} from './mappers';
import { isAuthenticated } from './session';

const LIMIT = 40;

interface AlbumPayload {
  album: BackendAlbum;
  items?: { id: string; position: number; voiceNote?: BackendVoiceNote }[];
}

export const httpAlbumRepository: AlbumRepository = {
  async getAlbums() {
    const data = await apiRequest<{ albums?: BackendAlbum[] }>('/albums/discover', {
      query: { limit: LIMIT },
    });
    return (data.albums ?? []).map(mapAlbumSummary);
  },

  async getFeatured() {
    const data = await apiRequest<{ albums?: BackendAlbum[] }>('/albums/discover', {
      query: { limit: LIMIT },
    });
    const albums = data.albums ?? [];
    return albums.length > 0 ? mapAlbumSummary(albums[0]) : null;
  },

  async getMyAlbums() {
    const data = await apiRequest<{ albums?: BackendAlbum[] }>('/albums', {
      query: { limit: LIMIT },
    });
    return (data.albums ?? []).map(mapAlbumSummary);
  },

  async getById(id) {
    try {
      const data = await apiRequest<AlbumPayload>(`/albums/${id}`, {
        auth: isAuthenticated(),
      });
      const summary = mapAlbumSummary(data.album);
      const tracks = (data.items ?? [])
        .map((item) => (item.voiceNote ? mapVoiceNote(item.voiceNote) : null))
        .filter((t): t is VoiceNote => Boolean(t));
      return {
        ...summary,
        voiceNoteIds: tracks.map((t) => t.id),
        trackCount: tracks.length,
        totalDuration: tracks.reduce((sum, t) => sum + t.duration, 0),
        tracks,
        likes: tracks.reduce((s, t) => s + t.likes, 0),
        comments: tracks.reduce((s, t) => s + t.comments, 0),
      } as AlbumDetail;
    } catch {
      return null;
    }
  },

  async getRelated(albumId, limit = 4) {
    const data = await apiRequest<{ albums?: BackendAlbum[] }>('/albums/discover', {
      query: { limit: LIMIT },
    });
    const rest = (data.albums ?? []).filter((a) => a.id !== albumId);
    // same creator first, then the rest — deterministic
    const source = data.albums?.find((a) => a.id === albumId);
    const ordered = source
      ? [
          ...rest.filter((a) => (a.owner?.id ?? a.ownerId) === (source.owner?.id ?? source.ownerId)),
          ...rest.filter((a) => (a.owner?.id ?? a.ownerId) !== (source.owner?.id ?? source.ownerId)),
        ]
      : rest;
    return ordered.slice(0, limit).map(mapAlbumSummary);
  },
};
