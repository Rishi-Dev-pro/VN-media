import { BookmarkX, MessageCircle } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { VoiceNote } from '../../data/types';
import { getCreator } from '../../data/mockCreators';
import { usePlayer } from '../../state/PlayerContext';
import { formatCount, formatTime } from '../../utils/format';
import { Equalizer } from '../common/Equalizer';
import { LikeButton } from '../common/LikeButton';
import { MoreMenu } from '../common/MoreMenu';
import './TrackRow.css';

interface TrackRowProps {
  note: VoiceNote;
  queue: VoiceNote[];
  /** 1-based track number — shown when provided (album track lists) */
  index?: number;
  /** show a comment count stat — optional, kept off Discover's rows */
  showComments?: boolean;
  /** notified when this note starts playing (optional — library records history) */
  onPlay?: (note: VoiceNote) => void;
  /** renders a remove-from-library action (optional) */
  onRemove?: (note: VoiceNote) => void;
}

export function TrackRow({ note, queue, index, showComments, onPlay, onRemove }: TrackRowProps) {
  const { current, isPlaying, play, toggle, toggleLike, isLiked } = usePlayer();
  const creator = getCreator(note.creatorId);

  const isCurrent = current?.id === note.id;
  const playing = isCurrent && isPlaying;
  const liked = isLiked(note.id);

  const activate = useCallback(() => {
    if (isCurrent) toggle();
    else {
      play(note, queue);
      onPlay?.(note);
    }
  }, [isCurrent, note, queue, play, toggle, onPlay]);

  return (
    <li>
      <div
        className={`track-row ${playing ? 'is-playing' : ''}`}
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        }}
        aria-label={`${note.title} by ${creator.name} — play`}
      >
      {index !== undefined && (
        <span className="track-row__index tabular" aria-hidden="true">
          {String(index).padStart(2, '0')}
        </span>
      )}

      <span className="track-row__art">
        <img src={note.cover} alt="" loading="lazy" width={44} height={44} />
        <span className="track-row__play-hint" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M8 5.5v13l11-6.5-11-6.5z" />
          </svg>
        </span>
      </span>

        <span className="track-row__meta">
          <span className="track-row__title-row">
            <Equalizer playing={playing} bars={3} className="track-row__eq" />
            <span className="track-row__title">{note.title}</span>
          </span>
          <Link
            to={`/creators/${creator.handle}`}
            className="track-row__handle"
            aria-label={`View profile of ${creator.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            @{creator.handle}
          </Link>
        </span>

        {showComments && (
          <span className="track-row__stat" title={`${formatCount(note.comments)} comments`}>
            <MessageCircle size={13} aria-hidden="true" />
            <span className="tabular">{formatCount(note.comments)}</span>
          </span>
        )}

        <span className="track-row__duration tabular">{formatTime(note.duration)}</span>

        <LikeButton
          liked={liked}
          iconOnly
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(note.id);
          }}
          label={note.title}
        />

        {onRemove && (
          <button
            type="button"
            className="track-row__remove"
            aria-label={`Remove ${note.title} from library`}
            title="Remove from library"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(note);
            }}
          >
            <BookmarkX size={15} aria-hidden="true" />
          </button>
        )}
        <span onClick={(e) => e.stopPropagation()} role="presentation">
          <MoreMenu itemLabel={note.title} />
        </span>
      </div>
    </li>
  );
}
