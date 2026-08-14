import type { Creator } from '../data/types';
import {
  conversations,
  messagesByConversation,
  type ChatMessage,
  type Conversation,
} from '../data/messages';
import { getCreator } from '../data/mockCreators';
import { seededWave } from '../utils/waveform';

/* ============================================================
   Message repository boundary.

   Session-local mock of the private messaging API. The UI only
   talks to the interface below; the integration phase swaps the
   implementation for an HTTP/Socket-backed one. A tiny pub/sub
   stands in for real-time delivery: sends, read-state changes
   and scripted replies notify subscribed views so the UI feels
   live without any network.
   ============================================================ */

export interface MessagePreview {
  kind: 'text' | 'audio' | 'deleted';
  text?: string;
  duration?: number;
}

export interface ConversationSummary {
  id: string;
  creatorId: string;
  creator: Creator;
  lastMessageAt: number;
  unread: number;
  muted: boolean;
  preview: MessagePreview;
}

export interface MessageRepository {
  getConversations(): Promise<ConversationSummary[]>;
  getMessages(conversationId: string): Promise<ChatMessage[]>;
  /** reuse an existing thread with this creator, or start a fresh one */
  getOrCreateConversation(creatorId: string): Promise<string>;
  sendTextMessage(conversationId: string, content: string): Promise<ChatMessage>;
  sendAudioMessage(conversationId: string, duration: number): Promise<ChatMessage>;
  deleteMessage(conversationId: string, messageId: string): Promise<void>;
  markConversationRead(conversationId: string): Promise<void>;
  /** wipe this thread locally (session-only, mock) */
  clearConversation(conversationId: string): Promise<void>;
  /** subscribe to live updates for a conversation ('' = all) */
  subscribe(conversationId: string, listener: (event: 'typing' | 'message') => void): () => void;
}

/** Simulated latency so loading states are real. */
const delay = (ms = 480) => new Promise<void>((r) => setTimeout(r, ms));

/* ---------- session state (mutated in place) ---------- */

const stateConversations: Conversation[] = conversations.map((c) => ({ ...c }));
const stateMessages: Record<string, ChatMessage[]> = Object.fromEntries(
  Object.entries(messagesByConversation).map(([id, msgs]) => [id, msgs.map((m) => ({ ...m }))]),
);
/** conversations that already fired their scripted reply this session */
const replied: Set<string> = new Set();

/* ---------- tiny pub/sub ---------- */

type Listener = (event: 'typing' | 'message') => void;
const listeners = new Map<string, Set<Listener>>();

function notify(conversationId: string, event: 'typing' | 'message') {
  listeners.get(conversationId)?.forEach((l) => l(event));
  listeners.get('')?.forEach((l) => l(event));
}

function latestMessage(msgs: ChatMessage[]): ChatMessage | undefined {
  return msgs.reduce<ChatMessage | undefined>((acc, m) => (!acc || m.sentAt > acc.sentAt ? m : acc), undefined);
}

function summarize(conv: Conversation): ConversationSummary {
  const msgs = stateMessages[conv.id] ?? [];
  const last = latestMessage(msgs);
  const creator = getCreator(conv.creatorId);
  let preview: MessagePreview;
  if (!last) preview = { kind: 'text', text: '' };
  else if (last.deleted) preview = { kind: 'deleted' };
  else if (last.kind === 'audio') preview = { kind: 'audio', duration: last.audio?.duration ?? 0 };
  else preview = { kind: 'text', text: last.text ?? '' };

  return {
    id: conv.id,
    creatorId: conv.creatorId,
    creator,
    lastMessageAt: last?.sentAt ?? 0,
    unread: conv.unread,
    muted: Boolean(conv.muted),
    preview,
  };
}

function advanceStatus(conversationId: string, messageId: string) {
  const steps: ChatMessage['status'][] = ['sent', 'delivered', 'seen'];
  const msgs = stateMessages[conversationId];
  const msg = msgs?.find((m) => m.id === messageId);
  if (!msg) return;
  let i = steps.indexOf(msg.status);
  if (i < 0 || i >= steps.length - 1) return;
  i += 1;
  const next = steps[i];
  setTimeout(() => {
    const cur = msgs.find((m) => m.id === messageId);
    if (cur && cur.status !== next) {
      cur.status = next;
      notify(conversationId, 'message');
    }
    if (next !== 'seen') advanceStatus(conversationId, messageId);
  }, next === 'delivered' ? 700 : 1800);
}

function scheduleReply(conversationId: string) {
  const conv = stateConversations.find((c) => c.id === conversationId);
  if (!conv?.scriptedReply || replied.has(conversationId)) return;
  replied.add(conversationId);

  // a short "typing…" beat, then the scripted reply lands
  setTimeout(() => {
    notify(conversationId, 'typing');
    setTimeout(() => {
      const msgs = stateMessages[conversationId];
      msgs.push({
        id: `reply-${conversationId}-${Date.now()}`,
        fromMe: false,
        kind: 'text',
        text: conv.scriptedReply,
        sentAt: Date.now(),
        status: 'sent',
        deleted: false,
      });
      notify(conversationId, 'message');
    }, 1500);
  }, 1600);
}

export const mockMessageRepository: MessageRepository = {
  async getConversations() {
    await delay();
    return stateConversations.map(summarize);
  },

  async getMessages(conversationId) {
    await delay(420);
    return [...(stateMessages[conversationId] ?? [])];
  },

  async getOrCreateConversation(creatorId) {
    await delay(260);
    const existing = stateConversations.find((c) => c.creatorId === creatorId);
    if (existing) return existing.id;
    const id = `conv-${creatorId.replace('crea-', '')}`;
    stateConversations.push({ id, creatorId, unread: 0 });
    stateMessages[id] = [];
    return id;
  },

  async sendTextMessage(conversationId, content) {
    await delay(140);
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      fromMe: true,
      kind: 'text',
      text: content,
      sentAt: Date.now(),
      status: 'sent',
      deleted: false,
    };
    stateMessages[conversationId].push(msg);
    advanceStatus(conversationId, msg.id);
    scheduleReply(conversationId);
    notify(conversationId, 'message');
    return msg;
  },

  async sendAudioMessage(conversationId, duration) {
    await delay(140);
    const msg: ChatMessage = {
      id: `aud-${Date.now()}`,
      fromMe: true,
      kind: 'audio',
      audio: { duration, waveform: seededWave(Date.now() % 100000) },
      sentAt: Date.now(),
      status: 'sent',
      deleted: false,
    };
    stateMessages[conversationId].push(msg);
    advanceStatus(conversationId, msg.id);
    scheduleReply(conversationId);
    notify(conversationId, 'message');
    return msg;
  },

  async deleteMessage(conversationId, messageId) {
    await delay(200);
    const msg = stateMessages[conversationId].find((m) => m.id === messageId);
    if (msg) {
      msg.deleted = true;
      msg.text = undefined;
      msg.audio = undefined;
      notify(conversationId, 'message');
    }
  },

  async markConversationRead(conversationId) {
    const conv = stateConversations.find((c) => c.id === conversationId);
    if (conv && conv.unread > 0) {
      conv.unread = 0;
      notify(conversationId, 'message');
    }
  },

  async clearConversation(conversationId) {
    await delay(200);
    stateMessages[conversationId] = [];
    const conv = stateConversations.find((c) => c.id === conversationId);
    if (conv) conv.unread = 0;
    notify(conversationId, 'message');
  },

  subscribe(conversationId, listener) {
    const key = conversationId;
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(listener);
    return () => {
      listeners.get(key)?.delete(listener);
    };
  },
};

/** Single access point — the integration phase swaps the impl here. */
export function createMessageRepository(): MessageRepository {
  return mockMessageRepository;
}
