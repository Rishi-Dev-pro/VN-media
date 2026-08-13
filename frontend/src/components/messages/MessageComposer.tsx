import {
  Mic,
  Pause,
  Play,
  Send,
  Smile,
  Square,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatTime } from '../../utils/format';
import { seededWave } from '../../utils/waveform';
import './MessageComposer.css';

const EMOJI = ['🎧', '✨', '🌙', '🔥', '🎙️', '👀', '🤝', '🫶', '💭', '🌊', '🚂', '🫠'];

type Mode = 'idle' | 'recording' | 'preview';

interface MessageComposerProps {
  disabled?: boolean;
  onSendText: (text: string) => void;
  onSendAudio: (duration: number, waveform: number[]) => void;
  onDiscardAudio: () => void;
}

export function MessageComposer({
  disabled = false,
  onSendText,
  onSendAudio,
  onDiscardAudio,
}: MessageComposerProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const startedAtRef = useRef<number>(0);
  const emojiRef = useRef<HTMLDivElement>(null);

  /* ----- recording timer ----- */
  useEffect(() => {
    if (mode !== 'recording') return;
    startedAtRef.current = Date.now();
    setRecordingSecs(0);
    const id = window.setInterval(() => {
      setRecordingSecs(Math.min(120, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 250);
    return () => window.clearInterval(id);
  }, [mode]);

  /* ----- emoji popover outside click ----- */
  useEffect(() => {
    if (!emojiOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEmojiOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [emojiOpen]);

  /* ----- preview playback (self-contained mock) ----- */
  useEffect(() => {
    if (mode !== 'preview' || !previewPlaying) return;
    setPreviewProgress(0);
    const id = window.setInterval(() => {
      setPreviewProgress((p) => {
        const next = p + 0.25 / Math.max(previewDuration, 1);
        if (next >= 1) {
          setPreviewPlaying(false);
          return 1;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [mode, previewPlaying, previewDuration]);

  /* ----- auto-grow textarea ----- */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
  }, [text]);

  const sendText = useCallback(() => {
    const value = text.trim();
    if (!value || mode !== 'idle') return;
    onSendText(value);
    setText('');
    taRef.current?.focus();
  }, [text, mode, onSendText]);

  const stopRecording = useCallback(() => {
    if (recordingSecs < 1) {
      setMode('idle');
      return;
    }
    setPreviewDuration(recordingSecs);
    setPreviewProgress(0);
    setPreviewPlaying(false);
    setMode('preview');
  }, [recordingSecs]);

  const sendAudio = useCallback(() => {
    onSendAudio(previewDuration, seededWave(previewDuration * 977 + 13));
    setMode('idle');
  }, [previewDuration, onSendAudio]);

  if (mode === 'recording') {
    return (
      <div className="composer composer--recording" role="group" aria-label="Recording voice message">
        <span className="composer__rec-dot" aria-hidden="true" />
        <span className="composer__rec-timer tabular">{formatTime(recordingSecs)}</span>
        <span className="composer__rec-bars" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className="composer__rec-bar" style={{ animationDelay: `${(i % 7) * 90}ms` }} />
          ))}
        </span>
        <button
          type="button"
          className="composer__rec-cancel"
          aria-label="Cancel recording"
          onClick={() => setMode('idle')}
        >
          <X size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="composer__rec-stop"
          aria-label="Stop and review recording"
          onClick={stopRecording}
        >
          <Square size={13} fill="currentColor" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (mode === 'preview') {
    const elapsed = Math.round(previewDuration * Math.min(Math.max(previewProgress, 0), 1));
    return (
      <div className="composer composer--preview" role="group" aria-label="Voice message preview">
        <span className="composer__preview-label micro">Voice message</span>
        <button
          type="button"
          className={`composer__preview-toggle ${previewPlaying ? 'is-playing' : ''}`}
          aria-label={previewPlaying ? 'Pause preview' : 'Play preview'}
          onClick={() => setPreviewPlaying((v) => !v)}
        >
          {previewPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <span className="composer__preview-wave" aria-hidden="true">
          {seededWave(previewDuration * 977 + 13).map((h, i, arr) => {
            const done = i / arr.length <= previewProgress;
            return (
              <span
                key={i}
                className={`composer__preview-bar ${done ? 'is-done' : ''} ${previewPlaying ? 'is-playing' : ''}`}
                style={{ height: `${Math.max(16, Math.round(h * 36))}%` }}
              />
            );
          })}
        </span>
        <span className="composer__preview-time tabular">{formatTime(elapsed)}</span>
        <button
          type="button"
          className="composer__preview-discard"
          onClick={() => {
            onDiscardAudio();
            setMode('idle');
          }}
        >
          Discard
        </button>
        <button
          type="button"
          className="composer__preview-send"
          onClick={sendAudio}
        >
          <Send size={14} aria-hidden="true" />
          Send
        </button>
      </div>
    );
  }

  return (
    <div className="composer">
      <div ref={emojiRef} className="composer__emoji-wrap">
        <button
          type="button"
          className="composer__tool"
          aria-label="Add emoji"
          aria-expanded={emojiOpen}
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => setEmojiOpen((v) => !v)}
        >
          <Smile size={17} aria-hidden="true" />
        </button>
        {emojiOpen && (
          <div className="composer__emoji-pop" role="dialog" aria-label="Choose an emoji">
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                className="composer__emoji"
                aria-label={`Insert ${e}`}
                onClick={() => {
                  setText((t) => t + e);
                  setEmojiOpen(false);
                  taRef.current?.focus();
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <textarea
        ref={taRef}
        className="composer__input"
        rows={1}
        placeholder="Write a message..."
        aria-label="Write a message"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendText();
          }
        }}
      />

      <button
        type="button"
        className="composer__tool composer__mic"
        aria-label="Record a voice message"
        disabled={disabled}
        onClick={() => setMode('recording')}
      >
        <Mic size={17} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="composer__send"
        aria-label="Send message"
        disabled={disabled || !text.trim()}
        onClick={sendText}
      >
        <Send size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
