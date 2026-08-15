/* ============================================================
   HTTP notification repository (Phase 18, API mode).

     GET   /api/notifications               stream + unreadCount
     PATCH /api/notifications/:id/read      mark one read
     PATCH /api/notifications/read-all      mark all read
     GET   /api/notifications/preferences   preference keys
     PATCH /api/notifications/preferences   update preferences

   Live arrivals come from the realtime socket (`notification:new`),
   which just triggers a refetch through the same REST boundary —
   stable backend ids make deduplication automatic (no REST+socket
   duplicates). Actors fetched here feed the cross-mode identity
   cache so notification cards never crash on backend ids.

   The mock `deliverFollow/deliverLike/deliverComment/startSimulation`
   calls are NO-OPS in API mode: the backend generates notifications
   itself through activity events. The frontend only consumes them.
   ============================================================ */

import type {
  NotificationPreferences,
  NotificationType,
} from '../../data/notifications';
import type { NotificationRepository } from '../notificationRepository';
import { apiRequest } from './apiClient';
import { mapNotification, type BackendNotification } from './mappers';
import { cacheActor } from './identity';
import { ensureSocket } from './realtime';
import { getSessionUser } from './session';

const listeners = new Set<() => void>();
// Track the socket instance the listener is attached to — NOT a boolean:
// logout destroys the socket (removeAllListeners) and login creates a NEW
// one, so a sticky flag would skip attaching the listener after re-login.
let attachedSocket: import('socket.io-client').Socket | null = null;

function notify(): void {
  listeners.forEach((l) => l());
}

function onNotificationNew(): void {
  notify();
}

function attachSocket(): void {
  const socket = ensureSocket();
  if (!socket || attachedSocket === socket) return;
  if (attachedSocket) attachedSocket.off('notification:new', onNotificationNew);
  attachedSocket = socket;
  socket.on('notification:new', onNotificationNew);
}

const KEY_MAP: Record<keyof NotificationPreferences, string> = {
  follows: 'userFollowed',
  likes: 'voiceNoteLiked',
  comments: 'voiceNoteCommented',
  messages: 'userFollowed', // unused server key — backend has no message notifications
};

function toPreferences(raw: {
  userFollowed?: boolean;
  voiceNoteLiked?: boolean;
  voiceNoteCommented?: boolean;
}): NotificationPreferences {
  return {
    follows: raw.userFollowed !== false,
    likes: raw.voiceNoteLiked !== false,
    comments: raw.voiceNoteCommented !== false,
    messages: true,
  };
}

export const httpNotificationRepository: NotificationRepository = {
  async getNotifications() {
    const data = await apiRequest<{
      items?: BackendNotification[];
      unreadCount?: number;
    }>('/notifications', { query: { limit: 50 } });
    const items = (data.items ?? []).map(mapNotification);
    // feed the identity cache so cards can resolve actors safely
    for (const dto of data.items ?? []) {
      if (dto.actor) {
        cacheActor(dto.actor.id, {
          name: dto.actor.username,
          handle: dto.actor.username,
          avatar: dto.actor.avatar ?? '',
        });
      }
    }
    return items;
  },

  async markAsRead(notificationId) {
    await apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' });
    notify();
  },

  async markAllAsRead() {
    await apiRequest('/notifications/read-all', { method: 'PATCH' });
    notify();
  },

  async getPreferences() {
    const raw = await apiRequest<{
      userFollowed?: boolean;
      voiceNoteLiked?: boolean;
      voiceNoteCommented?: boolean;
    }>('/notifications/preferences');
    return toPreferences(raw);
  },

  async setPreference(key, enabled) {
    if (key === 'messages') {
      // backend has no message-notification preference; reflect locally
      notify();
      return;
    }
    await apiRequest('/notifications/preferences', {
      method: 'PATCH',
      body: { [KEY_MAP[key]]: enabled },
    });
    notify();
  },

  subscribe(listener) {
    listeners.add(listener);
    attachSocket();
    return () => {
      listeners.delete(listener);
    };
  },

  startSimulation() {
    // API mode: the backend is the only source of live events
  },

  deliverFollow() {
    // backend generates USER_FOLLOWED itself
  },

  deliverLike() {
    // backend generates VOICE_NOTE_LIKED itself
  },

  deliverComment() {
    // backend generates VOICE_NOTE_COMMENTED itself
  },
};

/** Map a backend type string to the frontend NotificationType. */
export function normalizeType(type: string): NotificationType {
  switch (type) {
    case 'USER_FOLLOWED': return 'USER_FOLLOWED';
    case 'VOICE_NOTE_LIKED': return 'VOICE_NOTE_LIKED';
    case 'VOICE_NOTE_COMMENTED': return 'VOICE_NOTE_COMMENTED';
    default: return 'MESSAGE_RECEIVED';
  }
}

export function currentApiUserId(): string | null {
  return getSessionUser()?.id ?? null;
}
