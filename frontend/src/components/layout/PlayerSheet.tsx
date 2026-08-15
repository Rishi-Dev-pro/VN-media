import {
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ListMusic,
  MessageCircle,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { getCreatorSafe as getCreator } from '../../services/api/identity';
import { useCommentCount } from '../../hooks/useCommentCount';
import { useEngagement } from '../../hooks/useEngagement';
import { usePlayer } from '../../state/PlayerContext';
import { formatCount, formatReleaseDate, formatTime } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import { Equalizer } from '../common/Equalizer';
import { LikeButton } from '../common/LikeButton';
import { PlayerControls } from '../player/PlayerControls';
import './PlayerSheet.css';

interface PlayerSheetProps {
  open: boolean;
  onClose: () => void;
}

/** The full-screen / expanded player. One global PlayerContext — the
 *  UP NEXT list is the same queue every surface writes to. */
export function PlayerSheet({ open, onClose }: PlayerSheetProps) {
  const { current, isPlaying, queue, queueIndex, queueLabel, playbackError, retryPlayback, play, clearQueue, removeFromQueue, moveInQueue } = usePlayer();
  const { liked, likeCount, busy: likeBusy, toggle: toggleLike } = useEngagement(current);
  const commentCount = useCommentCount(current?.id ?? null, current?.comments ?? 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !current) return null;

  const creator = getCreator(current.creatorId);
  const upcoming = queue.slice(queueIndex + 1);
  const canClear = upcoming.length > 0;

  return (
    <div
      className="player-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing: ${current.title}`}
    >
      <div className="player-sheet__backdrop" onClick={onClose} aria-hidden="true" />

      <div className="player-sheet__panel">
        <div className="player-sheet__grabber" aria-hidden="true" />

        <div className="player-sheet__head">
          <button type="button" className="player-sheet__close" onClick={onClose} aria-label="Close player">
            <ChevronDown size={22} />
          </button>
          <span className="player-sheet__head-label micro">Now playing</span>
          <span className="player-sheet__head-spacer" aria-hidden="true" />
        </div>

        {playbackError ? (
          <div className="player-sheet__error" role="status">
            <span className="player-sheet__error-title">PLAYBACK SIGNAL LOST.</span>
            <span className="player-sheet__error-body">The VoiceNote couldn’t start.</span>
            <button
              type="button"
              className="player-sheet__retry"
              onClick={retryPlayback}
              aria-label="Retry playback"
            >
              <RotateCw size={14} aria-hidden="true" />
              RETRY
            </button>
          </div>
        ) : (
          <>
            <div className="player-sheet__art">
              <img key={current.id} src={current.cover} alt={`Artwork for ${current.title}`} />
              <div className="player-sheet__eq">
                <Equalizer playing={isPlaying} bars={5} />
              </div>
            </div>

            <div className="player-sheet__meta">
              <span className="player-sheet__chip micro">{current.category}</span>
              <h2 className="player-sheet__title">{current.title}</h2>
              <div className="player-sheet__creator">
                <Avatar src={creator.avatar} alt={creator.name} size={26} />
                <span>@{creator.handle}</span>
                <span className="player-sheet__plays tabular">· {formatCount(current.plays)} plays</span>
              </div>
            </div>

            <PlayerControls size="lg" />

            <div className="player-sheet__foot">
              <LikeButton
                liked={liked}
                count={likeCount}
                busy={likeBusy}
                onClick={() => void toggleLike()}
                label={current.title}
              />
              <span className="player-sheet__stat" title={`${formatCount(commentCount)} comments`}>
                <MessageCircle size={16} aria-hidden="true" />
                <span className="tabular">{formatCount(commentCount)}</span>
              </span>
              <span className="player-sheet__date tabular">{formatReleaseDate(current.releasedAt)}</span>
            </div>
          </>
        )}

        {/* ---- up next ---- */}
        <section className="player-sheet__queue" aria-label="Up next">
          <header className="player-sheet__queue-head">
            <span className="player-sheet__queue-title micro">
              <ListMusic size={13} aria-hidden="true" />
              Up next
              {queueLabel && (
                <span className="player-sheet__queue-origin">{queueLabel}</span>
              )}
            </span>
            {canClear && (
              <button
                type="button"
                className="player-sheet__queue-clear"
                onClick={clearQueue}
                aria-label="Clear up next — keep the current VoiceNote playing"
                title="Clear queue"
              >
                <Trash2 size={13} aria-hidden="true" />
                Clear
              </button>
            )}
          </header>

          {upcoming.length === 0 ? (
            <p className="player-sheet__queue-empty">
              <span className="player-sheet__queue-empty-title">QUEUE IS QUIET.</span>
              <span className="player-sheet__queue-empty-body">
                Add a VoiceNote to keep listening.
              </span>
            </p>
          ) : (
            <ul className="player-sheet__queue-list">
              {upcoming.map((note, u) => {
                const qIdx = queueIndex + 1 + u;
                const rowCreator = getCreator(note.creatorId);
                return (
                  <li key={note.id} className="queue-row">
                    <button
                      type="button"
                      className="queue-row__main"
                      onClick={() => play(note, queue)}
                      aria-label={`Play ${note.title} by ${rowCreator.name}`}
                    >
                      <img src={note.cover} alt="" loading="lazy" width={40} height={40} />
                      <span className="queue-row__meta">
                        <span className="queue-row__title">{note.title}</span>
                        <span className="queue-row__handle">@{rowCreator.handle}</span>
                      </span>
                      <span className="queue-row__dur tabular">{formatTime(note.duration)}</span>
                    </button>
                    <span className="queue-row__acts">
                      <button
                        type="button"
                        className="queue-row__act"
                        onClick={() => moveInQueue(qIdx, qIdx - 1)}
                        disabled={u === 0}
                        aria-label={`Move ${note.title} up`}
                        title="Move up"
                      >
                        <ChevronsUp size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="queue-row__act"
                        onClick={() => moveInQueue(qIdx, qIdx + 1)}
                        disabled={u === upcoming.length - 1}
                        aria-label={`Move ${note.title} down`}
                        title="Move down"
                      >
                        <ChevronsDown size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="queue-row__act queue-row__act--remove"
                        onClick={() => removeFromQueue(note.id)}
                        aria-label={`Remove ${note.title} from up next`}
                        title="Remove from queue"
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
