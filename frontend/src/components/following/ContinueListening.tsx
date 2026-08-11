import { Pause, Play } from 'lucide-react';
import { useCallback } from 'react';
import type { VoiceNote } from '../../data/types';
import { getCreator } from '../../data/mockCreators';
import { usePlayer } from '../../state/PlayerContext';
import { formatTime } from '../../utils/format';
import './ContinueListening.css';

interface ContinueListeningProps {
  notes: VoiceNote[];
}

/**
 * Compact horizontal strip of recently played notes. Playback flows
 * through the existing PlayerContext — no second player state.
 */
export function ContinueListening({ notes }: ContinueListeningProps) {
  return (
    <div className="continue-listening no-scrollbar">
      {notes.map((note, i) => (
        <ContinueItem key={note.id} note={note} queue={notes} index={i} />
      ))}
    </div>
  );
}

function ContinueItem({
  note,
  queue,
  index,
}: {
  note: VoiceNote;
  queue: VoiceNote[];
  index: number;
}) {
  const { current, isPlaying, play, toggle, elapsed } = usePlayer();
  const creator = getCreator(note.creatorId);
  const isCurrent = current?.id === note.id;
  const playing = isCurrent && isPlaying;
  const progress = isCurrent && current ? elapsed / current.duration : 0;

  const activate = useCallback(() => {
    if (isCurrent) toggle();
    else play(note, queue);
  }, [isCurrent, note, queue, play, toggle]);

  return (
    <div
      className={`continue-item ${playing ? 'is-playing' : ''}`}
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
      style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}
    >
      <span className="continue-item__art">
        <img src={note.cover} alt="" loading="lazy" width={120} height={120} />
        <span className="continue-item__play" aria-hidden="true">
          {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </span>
      </span>
      <span className="continue-item__title">{note.title}</span>
      <span className="continue-item__creator">@{creator.handle}</span>
      <span className="continue-item__foot">
        <span className="continue-item__time tabular">{formatTime(note.duration)}</span>
        <span className="continue-item__bar" aria-hidden="true">
          <i style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
        </span>
      </span>
    </div>
  );
}
