import { MessageCircle, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConversationHeader } from '../components/messages/ConversationHeader';
import { ConversationList } from '../components/messages/ConversationList';
import { MessageBubble } from '../components/messages/MessageBubble';
import { MessageComposer } from '../components/messages/MessageComposer';
import { getCreator } from '../data/mockCreators';
import { conversationById, type ChatMessage } from '../data/messages';
import { DEMO_NOW } from '../data/mockFollowing';
import { useMessages, useConversation } from '../hooks/useMessages';
import { formatReleaseDate } from '../utils/format';
import './ConversationPage.css';

/** Demo "active now" visual state (deterministic, mock only). */
const ACTIVE_NOW = new Set(['crea-luna', 'crea-elio']);

interface AudioState {
  id: string;
  duration: number;
  elapsed: number;
  playing: boolean;
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  const { conversations, loading: listLoading } = useMessages();
  const {
    messages,
    loading,
    error,
    retry,
    typing,
    sendText,
    sendAudio,
    deleteMessage,
    clearConversation,
  } = useConversation(conversationId);

  const conversation = conversationId ? conversationById[conversationId] : undefined;
  const creator = conversation ? getCreator(conversation.creatorId) : undefined;
  const activeNow = conversation ? ACTIVE_NOW.has(conversation.creatorId) : false;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [audio, setAudio] = useState<AudioState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  /* ----- mock audio playback clock ----- */
  useEffect(() => {
    if (!audio?.playing) return;
    const id = window.setInterval(() => {
      setAudio((a) => {
        if (!a) return a;
        const next = a.elapsed + 0.25;
        if (next >= a.duration) return { ...a, elapsed: a.duration, playing: false };
        return { ...a, elapsed: next };
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [audio?.playing, audio?.id, audio?.duration]);

  const toggleAudio = useCallback((msg: ChatMessage) => {
    const duration = msg.audio?.duration ?? 0;
    setAudio((a) => {
      if (a && a.id === msg.id) {
        return { ...a, playing: !a.playing, elapsed: a.playing ? a.elapsed : 0 };
      }
      return { id: msg.id, duration, elapsed: 0, playing: true };
    });
  }, []);

  /* ----- keep the newest message in view ----- */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typing, searchOpen]);

  /* ----- message search (deleted messages are excluded) ----- */
  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) => !m.deleted && m.kind === 'text' && (m.text ?? '').toLowerCase().includes(q),
    );
  }, [messages, searchQuery]);

  const send = useCallback(
    async (content: string) => {
      await sendText(content);
      showToast('MESSAGE SENT');
    },
    [sendText, showToast],
  );

  const sendVoice = useCallback(
    async (duration: number, _waveform: number[]) => {
      await sendAudio(duration);
      showToast('VOICE MESSAGE SENT');
    },
    [sendAudio, showToast],
  );

  const copyMessage = useCallback((msg: ChatMessage) => {
    const text = msg.text ?? '';
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      /* mock — clipboard may be unavailable */
    }
    showToast('COPIED TO CLIPBOARD');
  }, [showToast]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteMessage(deleteTarget.id);
    setDeleteTarget(null);
    showToast('MESSAGE DELETED');
  }, [deleteTarget, deleteMessage, showToast]);

  const confirmClear = useCallback(async () => {
    await clearConversation();
    setClearOpen(false);
    showToast('CONVERSATION CLEARED');
  }, [clearConversation, showToast]);

  if (!conversation || !creator) {
    return (
      <div className="conversation-page conversation-page--missing">
        <p>This conversation doesn't exist.</p>
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/messages')}>
          BACK TO MESSAGES
        </button>
      </div>
    );
  }

  return (
    <div className="conversation-page">
      <div className="conversation-page__list">
        <ConversationList conversations={conversations} loading={listLoading} activeId={conversationId} />
      </div>

      <section className="conversation-panel" aria-label={`Conversation with ${creator.name}`}>
        <ConversationHeader
          creator={creator}
          activeNow={activeNow}
          onBack={() => navigate('/messages')}
          searchOpen={searchOpen}
          onToggleSearch={() => {
            setSearchOpen((v) => !v);
            setSearchQuery('');
          }}
          onClearRequest={() => setClearOpen(true)}
        />

        {searchOpen && (
          <div className="conv-search">
            <Search size={14} aria-hidden="true" className="conv-search__icon" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search this conversation..."
              aria-label="Search this conversation"
              autoFocus
            />
            {searchQuery && (
              <span className="conv-search__count tabular">
                {visible.length} {visible.length === 1 ? 'result' : 'results'}
              </span>
            )}
            <button
              type="button"
              className="conv-search__close"
              aria-label="Close message search"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="conversation-messages" ref={scrollRef} aria-live="polite">
          {loading && (
            <div className="conversation-messages__sk" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className={`skeleton msg-sk ${i % 2 === 0 ? 'msg-sk--mine' : ''}`}
                  style={{ width: `${38 + ((i * 13) % 34)}%` }}
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="conversation-messages__state">
              <p>WE LOST THE SIGNAL.</p>
              <button type="button" className="btn btn--ghost" onClick={retry}>
                TRY AGAIN
              </button>
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div className="conversation-messages__state">
              <MessageCircle size={26} aria-hidden="true" />
              <p>{searchQuery ? 'No messages match your search.' : 'NO MESSAGES YET.'}</p>
              {!searchQuery && <span>Start the conversation.</span>}
            </div>
          )}

          {!loading && !error && visible.length > 0 && (
            <MessageThread messages={visible} counterpart={creator.name} audio={audio} onToggleAudio={toggleAudio} onCopy={copyMessage} onDelete={(m) => setDeleteTarget(m)} />
          )}

          {typing && (
            <div className="conversation-messages__typing" role="status">
              <span className="typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              {creator.name} is typing…
            </div>
          )}
        </div>

        <div className="conversation-composer">
          <MessageComposer
            onSendText={(t) => void send(t)}
            onSendAudio={(d, w) => void sendVoice(d, w)}
            onDiscardAudio={() => showToast('VOICE MESSAGE DISCARDED')}
          />
        </div>
      </section>

      {/* ---------- delete confirm ---------- */}
      {deleteTarget && (
        <ConfirmDialog
          title="DELETE MESSAGE?"
          body="This message will be removed from your conversation."
          confirmLabel="DELETE"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

      {/* ---------- clear confirm ---------- */}
      {clearOpen && (
        <ConfirmDialog
          title="CLEAR CONVERSATION?"
          body="This removes the thread locally on this device. It's mock-only — nothing is sent anywhere."
          confirmLabel="CLEAR"
          onCancel={() => setClearOpen(false)}
          onConfirm={() => void confirmClear()}
        />
      )}

      {/* ---------- toast ---------- */}
      {toast && (
        <div className="conversation-toast" role="status" aria-live="polite">
          <span className="conversation-toast__dot" aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Thread: date separators + bubbles
   ============================================================ */

interface MessageThreadProps {
  messages: ChatMessage[];
  counterpart: string;
  audio: AudioState | null;
  onToggleAudio: (msg: ChatMessage) => void;
  onCopy: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date(DEMO_NOW);
  const y = new Date(DEMO_NOW - 86400000);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'TODAY';
  if (same(d, y)) return 'YESTERDAY';
  return formatReleaseDate(new Date(ts).toISOString()).toUpperCase();
}

function MessageThread({ messages, counterpart, audio, onToggleAudio, onCopy, onDelete }: MessageThreadProps) {
  let lastDay = '';
  return (
    <div className="conversation-thread">
      {messages.map((m) => {
        const day = dayLabel(m.sentAt);
        const showDay = day !== lastDay;
        lastDay = day;
        const isCurrentAudio = audio?.id === m.id;
        return (
          <div key={m.id} className="conversation-thread__row">
            {showDay && <span className="conversation-thread__day micro">{day}</span>}
            <MessageBubble
              message={m}
              counterpart={counterpart}
              audioPlaying={Boolean(isCurrentAudio && audio?.playing)}
              audioProgress={isCurrentAudio && audio ? audio.elapsed / Math.max(audio.duration, 1) : 0}
              onToggleAudio={onToggleAudio}
              onCopy={onCopy}
              onDelete={onDelete}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   Confirm dialog
   ============================================================ */

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="conversation-dialog-backdrop"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="conversation-dialog" role="dialog" aria-modal="true" aria-labelledby="conv-dialog-title">
        <h2 id="conv-dialog-title" className="conversation-dialog__title">
          {title}
        </h2>
        <p className="conversation-dialog__body">{body}</p>
        <div className="conversation-dialog__actions">
          <button type="button" className="btn btn--ghost" ref={cancelRef} onClick={onCancel}>
            CANCEL
          </button>
          <button type="button" className="btn btn--ghost conversation-dialog__danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
