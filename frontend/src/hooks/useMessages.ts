import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../data/messages';
import {
  createMessageRepository,
  type ConversationSummary,
} from '../services/messageRepository';

const repo = createMessageRepository();

/** Demo switch — `/messages?demo=error` forces the error state. */
function demoError(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('demo') === 'error';
  } catch {
    return false;
  }
}

interface MessagesState {
  conversations: ConversationSummary[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  unreadTotal: number;
}

/** Conversation inbox — stays in sync with sends/reads via the repo pub/sub. */
export function useMessages(): MessagesState {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(false);
    try {
      if (demoError()) throw new Error('demo error');
      const list = await repo.getConversations();
      setConversations(list);
    } catch {
      setError(true);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const unsub = repo.subscribe('', () => void load(false));
    return unsub;
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread, 0);

  return { conversations, loading, error, retry, unreadTotal };
}

interface ConversationState {
  messages: ChatMessage[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  /** mock "the other person is typing…" indicator */
  typing: boolean;
  sendText: (content: string) => Promise<void>;
  sendAudio: (duration: number) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  clearConversation: () => Promise<void>;
  markRead: () => void;
}

/** A single conversation thread with live (mock) updates. */
export function useConversation(id: string | undefined): ConversationState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [typing, setTyping] = useState(false);
  const readRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const msgs = await repo.getMessages(id);
      setMessages(msgs);
    } catch {
      setError(true);
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      if (demoError()) throw new Error('demo error');
      const msgs = await repo.getMessages(id);
      setMessages(msgs);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setMessages([]);
    readRef.current = false;
    void load();
    const unsub = repo.subscribe(id, (event) => {
      if (event === 'typing') setTyping(true);
      else {
        setTyping(false);
        void refresh();
      }
    });
    return unsub;
  }, [id, load, refresh]);

  // opening the thread marks it read (once)
  useEffect(() => {
    if (id && !readRef.current) {
      readRef.current = true;
      void repo.markConversationRead(id);
    }
  }, [id]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const sendText = useCallback(
    async (content: string) => {
      if (!id) return;
      await repo.sendTextMessage(id, content);
      await refresh();
    },
    [id, refresh],
  );

  const sendAudio = useCallback(
    async (duration: number) => {
      if (!id) return;
      await repo.sendAudioMessage(id, duration);
      await refresh();
    },
    [id, refresh],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!id) return;
      await repo.deleteMessage(id, messageId);
      await refresh();
    },
    [id, refresh],
  );

  const clearConversation = useCallback(async () => {
    if (!id) return;
    await repo.clearConversation(id);
    await refresh();
  }, [id, refresh]);

  const markRead = useCallback(() => {
    if (!id) return;
    void repo.markConversationRead(id);
  }, [id]);

  return {
    messages,
    loading,
    error,
    retry,
    typing,
    sendText,
    sendAudio,
    deleteMessage,
    clearConversation,
    markRead,
  };
}
