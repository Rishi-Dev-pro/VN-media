import { Pause, Play, RotateCw, ChevronUp } from 'lucide-react';
import { getCreator } from '../../data/mockCreators';
import { usePlayer } from '../../state/PlayerContext';
import { formatTime } from '../../utils/format';
import { Equalizer } from '../common/Equalizer';
import './MiniPlayer.css';

interface MiniPlayerProps {
  onExpand: () => void;
}

/** Compact persistent player shown on every breakpoint whenever a
 *  VoiceNote is active. Tap to expand the full player. */
export function MiniPlayer({ onExpand }: MiniPlayerProps) {
  const { current, isPlaying, toggle, elapsed, playbackError, retryPlayback } = usePlayer();

  if (!current) return null;

  const creator = getCreator(current.creatorId);
  const progress = current.duration > 0 ? (elapsed / current.duration) * 100 : 0;

  return (
    <div className="mini-player" aria-hidden={false}>
      <button
        type="button"
        className="mini-player__main"
        onClick={onExpand}
        aria-label={`Expand player — ${current.title} by ${creator.name}`}
      >
        <img src={current.cover} alt="" width={44} height={44} />
        <span className="mini-player__meta">
          <span className="mini-player__title">{current.title}</span>
          <span className="mini-player__handle">
            @{creator.handle}
            <span className="mini-player__time tabular"> · {formatTime(elapsed)}</span>
          </span>
        </span>
        <span className="mini-player__eq">
          <Equalizer playing={isPlaying} bars={3} />
        </span>
        <ChevronUp size={16} className="mini-player__chevron" aria-hidden="true" />
      </button>

      {playbackError ? (
        <button
          type="button"
          className="mini-player__retry"
          onClick={retryPlayback}
          aria-label="Retry playback"
          title="Retry playback"
        >
          <RotateCw size={17} aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          className="mini-player__toggle"
          onClick={toggle}
          aria-label={isPlaying ? `Pause ${current.title}` : `Play ${current.title}`}
        >
          {isPlaying ? (
            <Pause size={17} fill="currentColor" aria-hidden="true" />
          ) : (
            <Play size={17} fill="currentColor" aria-hidden="true" />
          )}
        </button>
      )}

      <span className="mini-player__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </span>
    </div>
  );
}
