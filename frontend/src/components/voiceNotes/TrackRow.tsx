import { useCallback } from 'react';
import type { VoiceNote } from '../../data/types';
import { getCreator } from '../../data/mockCreators';
import { usePlayer } from '../../state/PlayerContext';
import { formatTime } from '../../utils/format';
import { Equalizer } from '../common/Equalizer';
import { LikeButton } from '../common/LikeButton';
import { MoreMenu } from '../common/MoreMenu';
import './TrackRow.css';

interface TrackRowProps {
  note: VoiceNote;
  queue: VoiceNote[];
}

export function TrackRow({ note, queue }: TrackRowProps) {
  const { current, isPlaying, play, toggle, toggleLike, isLiked } = usePlayer();
  const creator = getCreator(note.creatorId);

  const isCurrent = current?.id === note.id;
  const playing = isCurrent && isPlaying;
  const liked = isLiked(note.id);

  const activate = useCallback(() => {
    if (isCurrent) toggle();
    else play(note, queue);
  }, [isCurrent, note, queue, play, toggle]);

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
          <span className="track-row__handle">@{creator.handle}</span>
        </span>

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

        <span onClick={(e) => e.stopPropagation()} role="presentation">
          <MoreMenu itemLabel={note.title} />
        </span>
      </div>
    </li>
  );
}
