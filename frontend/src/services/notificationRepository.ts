import {
  initialNotifications,
  defaultPreferences,
  type AppNotification,
  type NotificationPreferences,
  type NotificationType,
} from '../data/notifications';
import { DEMO_NOW } from '../data/mockFollowing';
import { voiceNotesById } from '../data/mockVoiceNotes';

/* ============================================================
   Notification repository boundary.

   Session-local mock of the notification stream. The UI talks
   only to the interface below; the integration phase swaps the
   implementation for an HTTP/Socket-backed one behind the same
   `subscribe` surface. Incoming mock events are scripted and
   deterministic — one per type, once per session — and respect
   the listener's preferences (they never touch history).
   ============================================================ */

export interface NotificationRepository {
  getNotifications(): Promise<AppNotification[]>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  getPreferences(): Promise<NotificationPreferences>;
  setPreference(key: keyof NotificationPreferences, enabled: boolean): Promise<void>;
  /** live updates: fired whenever the dataset changes or an event arrives */
  subscribe(listener: () => void): () => void;
  /** start the scripted incoming-event simulation (once) */
  startSimulation(): void;
  /** deliver a deterministic incoming follow event (mock transport boundary) */
  deliverFollow(actorCreatorId: string): void;
  /** deliver a like event for a VoiceNote (public notes only) */
  deliverLike(voiceNoteId: string): void;
  /** deliver a comment event for a VoiceNote (public notes only) */
  deliverComment(voiceNoteId: string, preview: string): void;
}

const delay = (ms = 460) => new Promise<void>((r) => setTimeout(r, ms));

/* ---------- session state ---------- */

const stateNotifications: AppNotification[] = initialNotifications.map((n) => ({ ...n }));
const statePreferences: NotificationPreferences = { ...defaultPreferences };
const scriptedDelivered = new Set<NotificationType>();
let simulationStarted = false;
let lastId = 1000;

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

/** a new incoming event (respects the matching preference) */
function ingest(type: NotificationType, data: Partial<AppNotification>): void {
  const key: keyof NotificationPreferences =
    type === 'USER_FOLLOWED' ? 'follows' : type === 'VOICE_NOTE_LIKED' ? 'likes' : type === 'VOICE_NOTE_COMMENTED' ? 'comments' : 'messages';
  if (!statePreferences[key]) return;
  stateNotifications.unshift({
    id: `nt-live-${++lastId}`,
    type,
    actorId: '',
    readAt: null,
    createdAt: DEMO_NOW,
    ...data,
  });
  notify();
}

export const mockNotificationRepository: NotificationRepository = {
  async getNotifications() {
    await delay();
    return stateNotifications.map((n) => ({ ...n }));
  },

  async markAsRead(notificationId) {
    const n = stateNotifications.find((x) => x.id === notificationId);
    if (n && n.readAt === null) {
      n.readAt = Date.now();
      notify();
    }
  },

  async markAllAsRead() {
    stateNotifications.forEach((n) => {
      if (n.readAt === null) n.readAt = Date.now();
    });
    notify();
  },

  async getPreferences() {
    return { ...statePreferences };
  },

  async setPreference(key, enabled) {
    statePreferences[key] = enabled;
    notify();
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  deliverFollow(actorCreatorId) {
    ingest('USER_FOLLOWED', { actorId: actorCreatorId });
  },

  deliverLike(voiceNoteId) {
    const note = voiceNotesById[voiceNoteId];
    if (!note || (note.visibility ?? 'public') !== 'public') return;
    ingest('VOICE_NOTE_LIKED', { actorId: note.creatorId, voiceNoteId });
  },

  deliverComment(voiceNoteId, preview) {
    const note = voiceNotesById[voiceNoteId];
    if (!note || (note.visibility ?? 'public') !== 'public') return;
    ingest('VOICE_NOTE_COMMENTED', {
      actorId: note.creatorId,
      voiceNoteId,
      commentPreview: preview.slice(0, 90),
    });
  },

  startSimulation() {
    if (simulationStarted) return;
    simulationStarted = true;

    const script = (
      type: NotificationType,
      afterMs: number,
      data: Partial<AppNotification>,
    ) => {
      window.setTimeout(() => {
        if (scriptedDelivered.has(type)) return;
        scriptedDelivered.add(type);
        ingest(type, data);
      }, afterMs);
    };

    // deterministic arrivals — once per session, ~6s apart
    script('VOICE_NOTE_LIKED', 6000, { actorId: 'crea-luna', voiceNoteId: 'vn-midnight-frequency' });
    script('VOICE_NOTE_COMMENTED', 14000, {
      actorId: 'crea-nocturne',
      voiceNoteId: 'vn-slow-hours',
      commentPreview: 'The whole room goes quiet when this one plays.',
    });
    script('USER_FOLLOWED', 22000, { actorId: 'crea-amara' });
    script('MESSAGE_RECEIVED', 30000, { actorId: 'crea-mira', conversationId: 'conv-mira' });
  },
};

/** Single access point — the integration phase swaps the impl here. */
export function createNotificationRepository(): NotificationRepository {
  return mockNotificationRepository;
}
