import { BookmarkX, Disc3, MessageCircle, Pause, Play } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { VoiceNote } from '../../data/types';
import { getCreator } from '../../data/mockCreators';
import { DEMO_NOW } from '../../data/mockFollowing';
import { usePlayer } from '../../state/PlayerContext';
import { formatCount, formatRelative, formatTime } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import { Equalizer } from '../common/Equalizer';
import { LikeButton } from '../common/LikeButton';
import { MoreMenu } from '../common/MoreMenu';
import './FeedCard.css';

const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

interface FeedCardProps {
  note: VoiceNote;
  queue: VoiceNote[];
  index: number;
  /** open the comments UI for this note (optional — pages opt in) */
  onOpenComments?: (note: VoiceNote) => void;
  /** album this note belongs to — renders a From-album chip (optional) */
  album?: { id: string; title: string } | null;
  /** notified when this note starts playing (optional — library records history) */
  onPlay?: (note: VoiceNote) => void;
  /** renders a remove-from-library action (optional) */
  onRemove?: (note: VoiceNote) => void;
}

export function FeedCard({ note, queue, index, onOpenComments, album, onPlay, onRemove }: FeedCardProps) {
  const { current, isPlaying, play, toggle, toggleLike, isLiked } = usePlayer();

  const creator = getCreator(note.creatorId);

  const isCurrent = current?.id === note.id;
  const playing = isCurrent && isPlaying;
  const liked = isLiked(note.id);
  const isNew = DEMO_NOW - +new Date(note.releasedAt) <= NEW_WINDOW_MS;

  const activate = useCallback(() => {
    if (isCurrent) toggle();
    else {
      play(note, queue);
      onPlay?.(note);
    }
  }, [isCurrent, note, queue, play, toggle, onPlay]);

  return (
    <article
      className={`feed-card ${playing ? 'is-playing' : ''}`}
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      aria-label={`${note.title} by ${creator.name} — ${playing ? 'pause' : 'play'}`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <span className="feed-card__art">
        <img src={note.cover} alt="" loading={index < 3 ? 'eager' : 'lazy'} width={128} height={128} />
        <span className="feed-card__art-hint" aria-hidden="true">
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </span>
        <Equalizer playing={playing} bars={4} className="feed-card__art-eq" />
      </span>

      <span className="feed-card__body">
        <span className="feed-card__topline">
          <span className="feed-card__tag micro">{note.category}</span>
          {isNew && <span className="feed-card__new micro">●&nbsp; New</span>}
          {album && (
            <Link
              to={`/albums/${album.id}`}
              className="feed-card__album micro"
              aria-label={`From album ${album.title}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Disc3 size={11} aria-hidden="true" /> From {album.title}
            </Link>
          )}
          <span className="feed-card__time micro tabular">{formatRelative(note.releasedAt, DEMO_NOW)}</span>
        </span>

        <span className="feed-card__title">{note.title}</span>

        <Link
          to={`/creators/${creator.handle}`}
          className="feed-card__creator"
          aria-label={`View profile of ${creator.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar src={creator.avatar} alt={creator.name} size={20} />
          <span className="feed-card__handle">@{creator.handle}</span>
        </Link>

        <span className="feed-card__desc">{note.description}</span>

        <span className="feed-card__tags" aria-hidden="true">
          {note.tags.slice(0, 3).map((t) => (
            <span key={t} className="feed-card__tag-pill">
              #{t}
            </span>
          ))}
        </span>

        <span className="feed-card__meta">
          <span className="feed-card__play">
            {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            <span className="tabular">{formatTime(note.duration)}</span>
          </span>

          <span
            className="feed-card__actions"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <LikeButton
              liked={liked}
              count={note.likes + (liked ? 1 : 0)}
              label={note.title}
              className="feed-card__like"
              onClick={(e) => {
                e.stopPropagation();
                toggleLike(note.id);
              }}
            />
            <button
              type="button"
              className="feed-card__comments"
              aria-label={`${note.comments} comments on ${note.title}`}
              title="View comments"
              onClick={(e) => {
                e.stopPropagation();
                onOpenComments?.(note);
              }}
            >
              <MessageCircle size={16} aria-hidden="true" />
              <span className="tabular">{formatCount(note.comments)}</span>
            </button>
            {onRemove && (
              <button
                type="button"
                className="feed-card__remove"
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
            <MoreMenu itemLabel={note.title} align="right" />
          </span>
        </span>
      </span>
    </article>
  );
}
