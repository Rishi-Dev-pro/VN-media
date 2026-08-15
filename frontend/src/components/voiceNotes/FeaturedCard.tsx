import { Pause, Play } from 'lucide-react';
import { useCallback } from 'react';
import type { VoiceNote } from '../../data/types';
import { getCreatorSafe as getCreator } from '../../services/api/identity';
import { useEngagement } from '../../hooks/useEngagement';
import { usePlayer } from '../../state/PlayerContext';
import { formatTime } from '../../utils/format';
import { Equalizer } from '../common/Equalizer';
import { LikeButton } from '../common/LikeButton';
import './FeaturedCard.css';

interface FeaturedCardProps {
  note: VoiceNote;
  queue: VoiceNote[];
  /** rotation in degrees for the editorial cascade */
  rotation?: number;
  /** render the card partially hidden behind the previous one */
  cascade?: boolean;
  /** override the click behaviour (e.g. navigate elsewhere on the landing page) */
  onActivate?: () => void;
}

export function FeaturedCard({ note, queue, rotation = 0, cascade = false, onActivate }: FeaturedCardProps) {
  const { current, isPlaying, play, toggle } = usePlayer();
  const { liked, busy: likeBusy, toggle: toggleLike } = useEngagement(note);
  const creator = getCreator(note.creatorId);

  const isCurrent = current?.id === note.id;
  const playing = isCurrent && isPlaying;

  const activate = useCallback(() => {
    if (onActivate) return onActivate();
    if (isCurrent) toggle();
    else play(note, queue);
  }, [onActivate, isCurrent, note, queue, play, toggle]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  };

  return (
    <article
      className={`featured-card ${playing ? 'is-playing' : ''} ${cascade ? 'featured-card--cascade' : ''}`}
      style={{ '--card-rot': `${rotation}deg` } as React.CSSProperties}
      onClick={activate}
      onKeyDown={onKey}
      role="button"
      tabIndex={0}
      aria-label={`${note.title} by ${creator.name} — play`}
    >
      <div className="featured-card__art">
        <img src={note.cover} alt={`Artwork for ${note.title}`} loading="lazy" />
        <span className="featured-card__hole-ring" aria-hidden="true" />
        <span className="featured-card__chip micro">{note.category}</span>
        <span className="featured-card__scrim" aria-hidden="true" />
        <span className="featured-card__play" role="presentation">
          {playing ? (
            <Pause size={18} fill="currentColor" aria-hidden="true" />
          ) : (
            <Play size={18} fill="currentColor" aria-hidden="true" />
          )}
        </span>
      </div>

      <div className="featured-card__foot">
        <div className="featured-card__meta">
          <span className="featured-card__title-row">
            <Equalizer playing={playing} bars={3} className="featured-card__eq" />
            <h3 className="featured-card__title">{note.title}</h3>
          </span>
          <span className="featured-card__sub">
            @{creator.handle} · <span className="tabular">{formatTime(note.duration)}</span>
          </span>
        </div>
        <LikeButton
          liked={liked}
          iconOnly
          busy={likeBusy}
          onClick={(e) => {
            e.stopPropagation();
            void toggleLike();
          }}
          label={note.title}
        />
      </div>
    </article>
  );
}
