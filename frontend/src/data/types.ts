/** Domain types for the VN-Media frontend.
 *  These mirror the shapes the future API will return, so the
 *  UI can later swap the mock repository for a real service
 *  without rebuilding components. */

export type Category =
  | 'Ambient'
  | 'Story'
  | 'Field'
  | 'Lo-Fi'
  | 'Talk'
  | 'Textures';

export interface Creator {
  id: string;
  /** Public handle, e.g. `luna.wav` */
  handle: string;
  /** Display name */
  name: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  /** Tiny per-creator tint used sparingly in the UI */
  tint: string;
}

export interface VoiceNote {
  id: string;
  title: string;
  creatorId: string;
  category: Category;
  description: string;
  cover: string;
  /** duration in seconds */
  duration: number;
  plays: number;
  likes: number;
  comments: number;
  tags: string[];
  /** ISO date */
  releasedAt: string;
  /** Shown in the curated "Featured" rail */
  featured?: boolean;
}

export interface Album {
  id: string;
  title: string;
  creatorId: string;
  description: string;
  cover: string;
  voiceNoteIds: string[];
  year: number;
  /** ISO date the collection was published */
  createdAt: string;
  /** Featured in the album discovery hero */
  featured?: boolean;
  /** Public by default; future phases may add follower-only albums */
  visibility?: 'public' | 'followers';
}

export interface Tag {
  name: string;
  count: number;
}
