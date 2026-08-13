import { Pause, Play } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getCreator } from '../../data/mockCreators';
import type { VoiceNote } from '../../data/types';
import type { RecentEntry } from '../../services/libraryRepository';
import { usePlayer } from '../../state/PlayerContext';
import { formatTime } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import './ContinueCard.css';

interface ContinueCardProps {
  entry: RecentEntry;
  queue: VoiceNote[];
  /** notified when this note starts playing (library records history) */
  onPlay?: (note: VoiceNote) => void;
}

/** Horizontal continue-listening card with live progress for the current note. */
export function ContinueCard({ entry, queue, onPlay }: ContinueCardProps) {
  const { note } = entry;
  const { current, isPlaying, elapsed, play, toggle } = usePlayer();
  const creator = getCreator(note.creatorId);

  const isCurrent = current?.id === note.id;
  const playing = isCurrent && isPlaying;
  const pct =
    isCurrent && note.duration > 0 ? Math.min(elapsed / note.duration, 1) : entry.progress;

  const activate = useCallback(() => {
    if (isCurrent) toggle();
    else {
      play(note, queue);
      onPlay?.(note);
    }
  }, [isCurrent, note, queue, play, toggle, onPlay]);

  return (
    <article
      className={`continue-card ${playing ? 'is-playing' : ''}`}
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
    >
      <span className="continue-card__art">
        <img src={note.cover} alt="" loading="lazy" width={120} height={120} />
        <span className="continue-card__play" aria-hidden="true">
          {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </span>
      </span>

      <span className="continue-card__body">
        <span className="continue-card__tag micro">{note.category}</span>
        <span className="continue-card__title">{note.title}</span>
        <Link
          to={`/creators/${creator.handle}`}
          className="continue-card__creator"
          aria-label={`View profile of ${creator.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar src={creator.avatar} alt={creator.name} size={16} />
          <span>@{creator.handle}</span>
        </Link>
        <span className="continue-card__progress">
          <span className="continue-card__bar" aria-hidden="true">
            <span className="continue-card__fill" style={{ width: `${Math.round(pct * 100)}%` }} />
          </span>
          <span className="continue-card__times tabular">
            {formatTime(Math.round(note.duration * pct))} / {formatTime(note.duration)}
          </span>
        </span>
      </span>
    </article>
  );
}
