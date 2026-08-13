import { DEMO_NOW } from './mockFollowing';

/* ============================================================
   Notifications (mock).

   A quiet record of people who found the demo listener's voice.
   All timestamps anchor to DEMO_NOW; ids are stable so the UI
   can dedupe live arrivals from the scripted simulation.
   ============================================================ */

export type NotificationType =
  | 'USER_FOLLOWED'
  | 'VOICE_NOTE_LIKED'
  | 'VOICE_NOTE_COMMENTED'
  | 'MESSAGE_RECEIVED';

export interface AppNotification {
  id: string;
  type: NotificationType;
  /** existing creator id */
  actorId: string;
  /** voicenote id when the event targets one (like / comment) */
  voiceNoteId?: string;
  /** conversation id when the event is a message */
  conversationId?: string;
  /** short comment excerpt (comment events) */
  commentPreview?: string;
  /** epoch ms, or null while unread */
  readAt: number | null;
  /** epoch ms */
  createdAt: number;
}

export interface NotificationPreferences {
  follows: boolean;
  likes: boolean;
  comments: boolean;
  messages: boolean;
}

export const defaultPreferences: NotificationPreferences = {
  follows: true,
  likes: true,
  comments: true,
  messages: true,
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const now = DEMO_NOW;

export const initialNotifications: AppNotification[] = [
  // ---- unread, today ----
  { id: 'nt-01', type: 'USER_FOLLOWED', actorId: 'crea-luna', createdAt: now - 4 * HOUR, readAt: null },
  { id: 'nt-02', type: 'VOICE_NOTE_LIKED', actorId: 'crea-elio', voiceNoteId: 'vn-midnight-frequency', createdAt: now - 2 * HOUR - 20 * MIN, readAt: null },
  { id: 'nt-03', type: 'VOICE_NOTE_COMMENTED', actorId: 'crea-mira', voiceNoteId: 'vn-after-rain', commentPreview: 'That room tone is beautiful.', createdAt: now - 2 * HOUR, readAt: null },
  { id: 'nt-04', type: 'MESSAGE_RECEIVED', actorId: 'crea-luna', conversationId: 'conv-luna', createdAt: now - 40 * MIN, readAt: null },
  { id: 'nt-05', type: 'VOICE_NOTE_LIKED', actorId: 'crea-kairo', voiceNoteId: 'vn-neon-bloom', createdAt: now - 13 * MIN, readAt: null },

  // ---- read, yesterday ----
  { id: 'nt-06', type: 'USER_FOLLOWED', actorId: 'crea-aria', createdAt: now - DAY - 5 * HOUR, readAt: now - DAY - 2 * HOUR },
  { id: 'nt-07', type: 'VOICE_NOTE_LIKED', actorId: 'crea-marcus', voiceNoteId: 'vn-paper-satellites', createdAt: now - DAY - 3 * HOUR, readAt: now - DAY },
  { id: 'nt-08', type: 'VOICE_NOTE_COMMENTED', actorId: 'crea-theo', voiceNoteId: 'vn-slow-hours', commentPreview: 'That transition at the end is insane.', createdAt: now - DAY - 2 * HOUR, readAt: now - DAY + HOUR },

  // ---- read, earlier ----
  { id: 'nt-09', type: 'USER_FOLLOWED', actorId: 'crea-mira', createdAt: now - 2 * DAY, readAt: now - 2 * DAY + 3 * HOUR },
  { id: 'nt-10', type: 'VOICE_NOTE_LIKED', actorId: 'crea-amara', voiceNoteId: 'vn-after-rain', createdAt: now - 2 * DAY - 4 * HOUR, readAt: now - 2 * DAY },
  { id: 'nt-11', type: 'MESSAGE_RECEIVED', actorId: 'crea-elio', conversationId: 'conv-elio', createdAt: now - 2 * DAY - 6 * HOUR, readAt: now - 2 * DAY - HOUR },
  { id: 'nt-12', type: 'USER_FOLLOWED', actorId: 'crea-jude', createdAt: now - 5 * DAY, readAt: now - 5 * DAY + HOUR },
  { id: 'nt-13', type: 'VOICE_NOTE_COMMENTED', actorId: 'crea-solis', voiceNoteId: 'vn-midnight-frequency', commentPreview: 'Listened three times. Kept it playing.', createdAt: now - 5 * DAY - 2 * HOUR, readAt: now - 5 * DAY },
  { id: 'nt-14', type: 'USER_FOLLOWED', actorId: 'crea-wren', createdAt: now - 8 * DAY, readAt: now - 8 * DAY + 2 * HOUR },
  { id: 'nt-15', type: 'VOICE_NOTE_LIKED', actorId: 'crea-theo', voiceNoteId: 'vn-slow-hours', createdAt: now - 8 * DAY - 3 * HOUR, readAt: now - 8 * DAY },
];
