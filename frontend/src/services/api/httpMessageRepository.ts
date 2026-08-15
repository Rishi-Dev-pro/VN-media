/* ============================================================
   HTTP message repository (Phase 18, API mode).

     POST   /api/conversations                    get-or-create thread
     GET    /api/conversations                    inbox
     GET    /api/conversations/:id/messages       history
     POST   /api/conversations/:id/messages       send text
     POST   /api/conversations/:id/messages/audio send audio (multipart)
     PATCH  /api/conversations/:id/read           mark read
     DELETE /api/conversations/:id/messages/:id   soft delete (sender)

   Live updates come from the socket `message:new` event (backend
   emits to the recipient's room). Audio messages are real backend
   entities — the composer has no microphone, so a deterministic
   WAV of the chosen duration is uploaded through the real pipeline.

   Contract gap (documented): the backend has no "clear whole
   thread" endpoint, so `clearConversation` marks the thread read
   and refreshes rather than deleting server messages.
   ============================================================ */

import type { ChatMessage } from '../../data/messages';
import type {
  ConversationSummary,
  MessagePreview,
  MessageRepository,
} from '../messageRepository';
import { apiRequest } from './apiClient';
import { mapCreator, type BackendUser } from './mappers';
import { buildDemoWavBlob } from '../../utils/wav';
import { seededWave } from '../../utils/waveform';
import { ensureSocket } from './realtime';
import { getSessionUser } from './session';

interface BackendMessage {
  id: string;
  conversationId: string | null;
  content: string | null;
  messageType: 'text' | 'audio';
  audioUrl: string | null;
  duration: number | null;
  readAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  sender: BackendUser | null;
}

interface BackendConversation {
  id: string;
  otherParticipant: BackendUser | null;
  lastMessageAt: string | null;
  lastMessage: BackendMessage | null;
  unreadCount: number;
  createdAt: string;
}

const listeners = new Set<(event: 'typing' | 'message') => void>();
// Track the socket instance the listener is attached to — NOT a boolean:
// logout destroys the socket (removeAllListeners) and login creates a NEW
// one, so a sticky flag would skip attaching the listener after re-login.
let attachedSocket: import('socket.io-client').Socket | null = null;

function attachSocket(): void {
  const socket = ensureSocket();
  if (!socket || attachedSocket === socket) return;
  if (attachedSocket) attachedSocket.off('message:new', onMessageNew);
  attachedSocket = socket;
  socket.on('message:new', onMessageNew);
}

function onMessageNew(): void {
  notify('message');
}

function notify(event: 'typing' | 'message'): void {
  listeners.forEach((l) => l(event));
}

function meId(): string | null {
  return getSessionUser()?.id ?? null;
}

function mapMessage(m: BackendMessage): ChatMessage {
  const deleted = Boolean(m.deletedAt);
  return {
    id: m.id,
    fromMe: meId() ? m.sender?.id === meId() : false,
    kind: m.messageType === 'audio' ? 'audio' : 'text',
    text: deleted ? '' : (m.content ?? undefined),
    audio:
      m.messageType === 'audio' && !deleted
        ? { duration: m.duration ?? 5, waveform: seededWave(hash(m.id)) }
        : undefined,
    sentAt: new Date(m.createdAt).getTime(),
    status: m.readAt ? 'seen' : 'delivered',
    deleted,
  };
}

function mapPreview(m: BackendMessage | null): MessagePreview {
  if (!m) return { kind: 'text', text: '' };
  if (m.deletedAt) return { kind: 'deleted' };
  if (m.messageType === 'audio') return { kind: 'audio', duration: m.duration ?? 0 };
  return { kind: 'text', text: m.content ?? '' };
}

function mapConversation(c: BackendConversation): ConversationSummary {
  const other = c.otherParticipant ?? {
    id: 'unknown',
    username: 'unknown',
    avatar: null,
  };
  return {
    id: c.id,
    creatorId: other.id,
    creator: mapCreator(other),
    lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0,
    unread: c.unreadCount ?? 0,
    muted: false,
    preview: mapPreview(c.lastMessage),
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const httpMessageRepository: MessageRepository = {
  async getConversations() {
    const data = await apiRequest<{ items?: BackendConversation[] }>('/conversations', {
      query: { limit: 50 },
    });
    return (data.items ?? []).map(mapConversation);
  },

  async getMessages(conversationId) {
    const data = await apiRequest<{ items?: BackendMessage[] }>(
      `/conversations/${conversationId}/messages`,
      { query: { limit: 100 } },
    );
    return (data.items ?? []).map(mapMessage);
  },

  async getOrCreateConversation(creatorId) {
    const data = await apiRequest<{ conversation: BackendConversation }>('/conversations', {
      method: 'POST',
      body: { userId: creatorId },
    });
    return data.conversation.id;
  },

  async sendTextMessage(conversationId, content) {
    const data = await apiRequest<{ message: BackendMessage }>(
      `/conversations/${conversationId}/messages`,
      { method: 'POST', body: { content } },
    );
    notify('message');
    return mapMessage(data.message);
  },

  async sendAudioMessage(conversationId, duration) {
    const form = new FormData();
    form.append('audio', buildDemoWavBlob(duration), 'message-audio.wav');
    const data = await apiRequest<{ message: BackendMessage }>(
      `/conversations/${conversationId}/messages/audio`,
      { method: 'POST', formData: form },
    );
    notify('message');
    return mapMessage(data.message);
  },

  async deleteMessage(conversationId, messageId) {
    await apiRequest(`/conversations/${conversationId}/messages/${messageId}`, {
      method: 'DELETE',
    });
    notify('message');
  },

  async markConversationRead(conversationId) {
    await apiRequest(`/conversations/${conversationId}/read`, { method: 'PATCH' });
    notify('message');
  },

  async clearConversation(conversationId) {
    // No backend "clear thread" endpoint — mark read so the inbox stays honest.
    await this.markConversationRead(conversationId);
  },

  subscribe(_conversationId, listener) {
    listeners.add(listener);
    attachSocket();
    return () => {
      listeners.delete(listener);
    };
  },
};
