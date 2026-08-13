import { Check, CheckCheck, Copy, Link2, MoreHorizontal, Pause, Play, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../data/messages';
import { formatTime } from '../../utils/format';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: ChatMessage;
  /** name used in aria labels (the other party's display name) */
  counterpart: string;
  /** is this message's audio currently playing? */
  audioPlaying: boolean;
  /** 0..1 playback progress for this message's audio */
  audioProgress: number;
  onToggleAudio: (message: ChatMessage) => void;
  onCopy: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
}

function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function MessageBubble({
  message,
  counterpart,
  audioPlaying,
  audioProgress,
  onToggleAudio,
  onCopy,
  onDelete,
}: MessageBubbleProps) {
  const mine = message.fromMe;

  if (message.deleted) {
    return (
      <div className={`msg-bubble msg-bubble--deleted ${mine ? 'msg-bubble--mine' : ''}`}>
        <span className="msg-bubble__deleted">
          <Trash2 size={13} aria-hidden="true" />
          {message.kind === 'audio' ? 'Voice message deleted' : 'Message deleted'}
        </span>
        <span className="msg-bubble__time tabular">{clockTime(message.sentAt)}</span>
      </div>
    );
  }

  return (
    <div className={`msg-bubble ${mine ? 'msg-bubble--mine' : ''}`}>
      {message.kind === 'audio' && message.audio ? (
        <div className="msg-bubble__audio">
          <AudioWave
            message={message}
            playing={audioPlaying}
            progress={audioProgress}
            onToggle={() => onToggleAudio(message)}
          />
          <span className="msg-bubble__meta">
            {clockTime(message.sentAt)}
            {mine && <ReadState status={message.status} />}
          </span>
        </div>
      ) : (
        <>
          <p className="msg-bubble__text">{message.text}</p>
          <span className="msg-bubble__meta">
            {clockTime(message.sentAt)}
            {mine && <ReadState status={message.status} />}
          </span>
          {mine && (
            <BubbleMenu message={message} counterpart={counterpart} onCopy={onCopy} onDelete={onDelete} />
          )}
        </>
      )}
    </div>
  );
}

function ReadState({ status }: { status: ChatMessage['status'] }) {
  if (status === 'seen') {
    return (
      <span className="msg-bubble__read tabular" title="Seen">
        <CheckCheck size={13} aria-hidden="true" /> Seen
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="msg-bubble__read tabular" title="Delivered">
        <CheckCheck size={13} aria-hidden="true" /> Delivered
      </span>
    );
  }
  return (
    <span className="msg-bubble__read tabular" title="Sent">
      <Check size={13} aria-hidden="true" /> Sent
    </span>
  );
}

/* ---------------- audio waveform ---------------- */

interface AudioWaveProps {
  message: ChatMessage;
  playing: boolean;
  progress: number;
  onToggle: () => void;
}

function AudioWave({ message, playing, progress, onToggle }: AudioWaveProps) {
  const duration = message.audio?.duration ?? 0;
  const bars = message.audio?.waveform ?? [];
  const played = Math.min(Math.max(progress, 0), 1);
  const elapsed = Math.round(duration * played);

  return (
    <div className="msg-audio" role="group" aria-label={`Voice message, ${formatTime(duration)}`}>
      <button
        type="button"
        className={`msg-audio__toggle ${playing ? 'is-playing' : ''}`}
        onClick={onToggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
      </button>
      <span className="msg-audio__wave" aria-hidden="true">
        {bars.map((h, i) => {
          const done = i / bars.length <= played;
          return (
            <span
              key={i}
              className={`msg-audio__bar ${done ? 'is-done' : ''} ${playing ? 'is-playing' : ''}`}
              style={{ height: `${Math.max(14, Math.round(h * 34))}%` }}
            />
          );
        })}
      </span>
      <span className="msg-audio__time tabular">
        {playing ? formatTime(elapsed) : formatTime(duration)}
      </span>
    </div>
  );
}

/* ---------------- per-message menu (Copy / Delete) ---------------- */

interface BubbleMenuProps {
  message: ChatMessage;
  counterpart: string;
  onCopy: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
}

function BubbleMenu({ message, counterpart, onCopy, onDelete }: BubbleMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="bubble-menu">
      <button
        type="button"
        className="bubble-menu__trigger"
        aria-label={`More options for your message to ${counterpart}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="bubble-menu__pop" role="menu" aria-label="Message options">
          <button
            type="button"
            role="menuitem"
            className="bubble-menu__item"
            onClick={() => {
              setOpen(false);
              onCopy(message);
            }}
          >
            {message.kind === 'audio' ? <Link2 size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {message.kind === 'audio' ? 'Copy link' : 'Copy'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="bubble-menu__item is-danger"
            onClick={() => {
              setOpen(false);
              onDelete(message);
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
