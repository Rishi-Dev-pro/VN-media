import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlayer } from '../../state/PlayerContext';
import { formatTime } from '../../utils/format';
import { IconButton } from '../common/IconButton';
import { Slider } from '../common/Slider';
import './PlayerControls.css';

const SPEEDS = [0.75, 1, 1.25, 1.5];

interface PlayerControlsProps {
  size?: 'md' | 'lg';
}

/** Transport + seek + volume + speed. Used by the featured player
 *  (desktop/tablet) and the full-screen sheet (mobile). */
export function PlayerControls({ size = 'md' }: PlayerControlsProps) {
  const {
    current,
    isPlaying,
    elapsed,
    toggle,
    next,
    prev,
    seek,
    volume,
    setVolume,
    speed,
    setSpeed,
    shuffle,
    toggleShuffle,
    repeat,
    cycleRepeat,
  } = usePlayer();

  if (!current) return null;

  const progress = current.duration > 0 ? elapsed / current.duration : 0;
  const muted = volume <= 0.005;
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;

  const cycleSpeed = () => {
    const i = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
  };

  return (
    <div className={`player-controls player-controls--${size}`}>
      <Slider
        value={progress}
        onChange={(f) => seek(f * current.duration)}
        label={`Seek — ${current.title}`}
      />

      <div className="player-controls__times tabular">
        <span>{formatTime(elapsed)}</span>
        <span>{formatTime(current.duration)}</span>
      </div>

      <div className="player-controls__transport">
        <IconButton
          label={shuffle ? 'Shuffle on' : 'Shuffle off'}
          active={shuffle}
          onClick={toggleShuffle}
        >
          <Shuffle />
        </IconButton>

        <IconButton label="Previous VoiceNote" onClick={prev}>
          <SkipBack />
        </IconButton>

        <button
          type="button"
          className="transport__play"
          onClick={toggle}
          aria-label={isPlaying ? `Pause ${current.title}` : `Play ${current.title}`}
        >
          {isPlaying ? (
            <Pause size={22} fill="currentColor" aria-hidden="true" />
          ) : (
            <Play size={22} fill="currentColor" aria-hidden="true" />
          )}
        </button>

        <IconButton label="Next VoiceNote" onClick={next}>
          <SkipForward />
        </IconButton>

        <IconButton
          label={`Repeat ${repeat}`}
          active={repeat !== 'off'}
          onClick={cycleRepeat}
        >
          <RepeatIcon />
        </IconButton>
      </div>

      <div className="player-controls__volume">
        <IconButton
          label={muted ? 'Unmute' : 'Mute'}
          size="sm"
          onClick={() => setVolume(muted ? 0.7 : 0)}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </IconButton>
        <Slider
          value={volume}
          onChange={setVolume}
          label="Volume"
          className="player-controls__volume-slider"
        />
        <button
          type="button"
          className="speed-pill tabular"
          onClick={cycleSpeed}
          aria-label={`Playback speed ${speed}×`}
        >
          {speed}×
        </button>
      </div>
    </div>
  );
}
