/* ============================================================
   Backend DTO → frontend domain mappers (Phase 18).

   The backend schema differs from the frontend's domain models
   (e.g. VoiceNote carries `owner` instead of `creatorId`, albums
   have `coverImage`, users have no `tint`). Every transformation
   lives HERE at the repository boundary — components never see
   raw backend field names.

   Local imagery is used ONLY as deterministic artwork fallback
   (the backend stores no artwork for VoiceNotes); identity and
   content always come from the backend.
   ============================================================ */

import type { Category, Creator, VoiceNote } from '../../data/types';
import type { CreatorProfile } from '../creatorRepository';
import type { AlbumSummary } from '../albumRepository';
import type { MockComment } from '../../data/mockComments';
import type { AppNotification, NotificationType } from '../../data/notifications';
import { hashString } from '../../utils/seeded';
import { API_BASE_URL } from './apiConfig';

/* ---------- deterministic local fallbacks ---------- */

const ART_POOL = [
  '/images/hero-headphones.jpg',
  '/images/forest-mist.jpg',
  '/images/concert-lights.jpg',
  '/images/neon-headphones.jpg',
  '/images/mountain-peak.jpg',
  '/images/studio-podcast.jpg',
  '/images/mic-stage.jpg',
  '/images/forest-light.jpg',
  '/images/headphones-teal.jpg',
  '/images/cta-studio.jpg',
];

const AVATAR_POOL = [
  '/images/portrait-1.jpg',
  '/images/portrait-2.jpg',
  '/images/portrait-3.jpg',
  '/images/portrait-4.jpg',
  '/images/portrait-5.jpg',
  '/images/portrait-6.jpg',
  '/images/portrait-8.jpg',
  '/images/portrait-9.jpg',
  '/images/portrait-10.jpg',
  '/images/portrait-11.jpg',
  '/images/portrait-12.jpg',
  '/images/portrait-13.jpg',
  '/images/portrait-14.jpg',
];

const TINTS = [
  '#9fd4e8', '#e8b6a8', '#b7c4f0', '#e2a8d8',
  '#a8d8c4', '#e8d8a8', '#c4a8e8', '#d8a8b0',
];

export function pickArt(seed: string): string {
  return ART_POOL[Math.abs(hashString(seed)) % ART_POOL.length];
}

export function pickAvatar(seed: string): string {
  return AVATAR_POOL[Math.abs(hashString(seed)) % AVATAR_POOL.length];
}

export function pickTint(seed: string): string {
  return TINTS[Math.abs(hashString(seed)) % TINTS.length];
}

const CATEGORY_ALIASES: Record<string, Category> = {
  ambient: 'Ambient',
  story: 'Story',
  field: 'Field',
  'field-recording': 'Field',
  lo_fi: 'Lo-Fi',
  lofi: 'Lo-Fi',
  'lo-fi': 'Lo-Fi',
  talk: 'Talk',
  monologue: 'Talk',
  textures: 'Textures',
  texture: 'Textures',
};

/** Derive a category from backend tags (deterministic, tag-driven). */
export function categoryFromTags(tags: string[]): Category {
  for (const t of tags) {
    const key = t.trim().toLowerCase().replace(/\s+/g, '-');
    if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  }
  return 'Ambient';
}

/* ---------- backend DTO shapes ---------- */

export interface BackendUser {
  id: string;
  username: string;
  avatar: string | null;
  bio?: string;
  createdAt?: string;
  email?: string;
}

export interface BackendVoiceNote {
  id: string;
  title: string;
  description: string;
  audioUrl?: string | null;
  duration: number;
  visibility: 'public' | 'private';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  owner?: BackendUser;
  ownerId?: string;
  likeCount?: number;
  likedByMe?: boolean;
  commentCount?: number;
}

export interface BackendAlbum {
  id: string;
  title: string;
  description: string;
  coverImage?: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  owner?: BackendUser;
  ownerId?: string;
  publicItemCount?: number;
}

export interface BackendComment {
  id: string;
  content: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  author: BackendUser | null;
  replies?: BackendComment[];
}

export interface BackendNotification {
  id: string;
  type: string;
  actor: BackendUser | null;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

/* ---------- VoiceNote ---------- */

export function mapVoiceNote(dto: BackendVoiceNote): VoiceNote {
  const ownerId = dto.owner?.id ?? dto.ownerId ?? 'unknown';
  return {
    id: dto.id,
    title: dto.title,
    creatorId: ownerId,
    category: categoryFromTags(dto.tags ?? []),
    description: dto.description || '',
    cover: pickArt(dto.id),
    duration: Math.max(1, Math.round(dto.duration || 1)),
    plays: 0,
    likes: dto.likeCount ?? 0,
    comments: dto.commentCount ?? 0,
    tags: [...(dto.tags ?? [])],
    releasedAt: dto.createdAt,
    visibility: dto.visibility === 'private' ? 'private' : 'public',
    // real media source — the authorized stream endpoint (bearer not needed
    // for public notes; private notes fetch a blob through the client)
    audioUrl: `${API_BASE_URL}/api/vns/${dto.id}/stream`,
  };
}

/** Backend audio lives behind the authorized stream endpoint. */
export function streamUrlFor(noteId: string): string {
  return `/vns/${noteId}/stream`;
}

/* ---------- Creator ---------- */

/** A backend public user shaped as a frontend Creator (stats optional). */
export function mapCreator(
  user: BackendUser,
  stats?: { followers?: number; following?: number; publicVoiceNotes?: number; publicAlbums?: number },
  relationship?: { isFollowing: boolean },
): CreatorProfile {
  const creator: Creator = {
    id: user.id,
    handle: user.username,
    name: user.username,
    avatar: user.avatar ?? pickAvatar(user.id),
    bio: user.bio ?? '',
    followers: stats?.followers ?? 0,
    following: stats?.following ?? 0,
    tags: [],
    joinedAt: user.createdAt ?? new Date().toISOString(),
    tint: pickTint(user.id),
  };

  return {
    ...creator,
    voiceNoteCount: stats?.publicVoiceNotes ?? 0,
    albumCount: stats?.publicAlbums ?? 0,
    totalPlays: 0,
    relationship,
  };
}

/* ---------- Album ---------- */

export function mapAlbumSummary(dto: BackendAlbum): AlbumSummary {
  const owner = dto.owner ?? { id: dto.ownerId ?? 'unknown', username: 'unknown', avatar: null };
  const year = new Date(dto.createdAt).getFullYear();
  return {
    id: dto.id,
    title: dto.title,
    creatorId: owner.id,
    creatorHandle: owner.username,
    creatorName: owner.username,
    creatorAvatar: owner.avatar ?? pickAvatar(owner.id),
    description: dto.description || '',
    cover: dto.coverImage ?? pickArt(dto.id),
    year,
    createdAt: dto.createdAt,
    voiceNoteIds: [],
    trackCount: dto.publicItemCount ?? 0,
    totalDuration: 0,
    plays: 0,
    visibility: dto.visibility === 'private' ? 'followers' : 'public',
  };
}

/* ---------- Comment ---------- */

/** Flatten backend threads (nested `replies`) into the flat MockComment list. */
export function mapComments(dtos: BackendComment[]): MockComment[] {
  const flat: MockComment[] = [];
  for (const dto of dtos) {
    flat.push(mapComment(dto));
    for (const reply of dto.replies ?? []) flat.push(mapComment(reply));
  }
  return flat;
}

function mapComment(dto: BackendComment): MockComment {
  const deleted = Boolean(dto.deletedAt);
  return {
    id: dto.id,
    voiceNoteId: '',
    parentCommentId: dto.parentCommentId ?? undefined,
    authorName: deleted ? '' : (dto.author?.username ?? 'unknown'),
    authorHandle: deleted ? '' : (dto.author?.username ?? 'unknown'),
    avatar: deleted ? '' : (dto.author?.avatar ?? pickAvatar(dto.id)),
    text: deleted ? '' : dto.content,
    createdAt: dto.createdAt,
    likes: 0,
    status: deleted ? 'deleted' : 'active',
  };
}

/* ---------- Notification ---------- */

const TYPE_MAP: Record<string, NotificationType> = {
  USER_FOLLOWED: 'USER_FOLLOWED',
  VOICE_NOTE_LIKED: 'VOICE_NOTE_LIKED',
  VOICE_NOTE_COMMENTED: 'VOICE_NOTE_COMMENTED',
};

export function mapNotification(dto: BackendNotification): AppNotification {
  const type = TYPE_MAP[dto.type] ?? 'VOICE_NOTE_LIKED';
  const targetId = dto.targetId ?? '';
  const metadata = dto.metadata ?? {};
  return {
    id: dto.id,
    type,
    actorId: dto.actor?.id ?? '',
    readAt: dto.readAt ? new Date(dto.readAt).getTime() : null,
    createdAt: new Date(dto.createdAt).getTime(),
    ...(type === 'VOICE_NOTE_LIKED' || type === 'VOICE_NOTE_COMMENTED'
      ? { voiceNoteId: targetId }
      : {}),
    ...(type === 'VOICE_NOTE_COMMENTED'
      ? {
          commentPreview:
            typeof metadata.commentPreview === 'string'
              ? metadata.commentPreview.slice(0, 90)
              : undefined,
        }
      : {}),
  };
}

/** Frontend notification preferences ↔ backend preference keys. */
export const PREFERENCE_KEY_MAP: Record<keyof import('../../data/notifications').NotificationPreferences, string> = {
  follows: 'USER_FOLLOWED',
  likes: 'VOICE_NOTE_LIKED',
  comments: 'VOICE_NOTE_COMMENTED',
  messages: 'MESSAGE_RECEIVED',
};
