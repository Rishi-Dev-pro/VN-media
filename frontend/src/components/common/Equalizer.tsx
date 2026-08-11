import './Equalizer.css';

interface EqualizerProps {
  playing: boolean;
  className?: string;
  bars?: number;
}

/** Tiny animated bars shown next to the currently-playing item. */
export function Equalizer({ playing, className = '', bars = 4 }: EqualizerProps) {
  return (
    <span
      className={`eq ${playing ? 'is-playing' : ''} ${className}`}
      role="img"
      aria-label={playing ? 'Playing' : 'Paused'}
    >
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="eq__bar" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}
