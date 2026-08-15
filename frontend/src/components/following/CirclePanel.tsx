import { Pause, Play, Users } from 'lucide-react';
import { getCreatorSafe as getCreator, getListener } from '../../services/api/identity';
import { usePlayer } from '../../state/PlayerContext';
import { formatTime } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import { Equalizer } from '../common/Equalizer';
import './CirclePanel.css';

interface CirclePanelProps {
  followingCount: number;
  newThisWeek: number;
  feedCount: number;
}

export function CirclePanel({ followingCount, newThisWeek, feedCount }: CirclePanelProps) {
  const { current, isPlaying, toggle } = usePlayer();
  const creator = current ? getCreator(current.creatorId) : null;
  const listener = getListener();

  return (
    <aside className="circle-panel" aria-label="Your circle">
      {/* ---- circle stats ---- */}
      <section className="circle-card">
        <h3 className="circle-card__title micro">Your circle</h3>
        <div className="circle-card__listener">
          <Avatar src={listener.avatar} alt="You" size={34} ring />
          <span>
            <span className="circle-card__who">Listening as</span>
            <span className="circle-card__handle">@{listener.handle}</span>
          </span>
        </div>
        <div className="circle-card__stats">
          <div className="circle-card__stat">
            <strong className="tabular">{followingCount}</strong>
            <span>following</span>
          </div>
          <div className="circle-card__stat">
            <strong className="tabular">{newThisWeek}</strong>
            <span>new this week</span>
          </div>
          <div className="circle-card__stat">
            <strong className="tabular">{feedCount}</strong>
            <span>in your feed</span>
          </div>
        </div>
      </section>

      {/* ---- now playing (bound to the existing player) ---- */}
      <section className="circle-card circle-card--now">
        <h3 className="circle-card__title micro">Now playing</h3>
        {current ? (
          <button
            type="button"
            className="now-card"
            onClick={toggle}
            aria-label={`${isPlaying ? 'Pause' : 'Play'} ${current.title}`}
          >
            <span className="now-card__art">
              <img src={current.cover} alt="" loading="lazy" width={56} height={56} />
              <span className="now-card__hint" aria-hidden="true">
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </span>
            </span>
            <span className="now-card__meta">
              <span className="now-card__title">{current.title}</span>
              <span className="now-card__handle">@{creator?.handle}</span>
              <span className="now-card__row">
                <Equalizer playing={isPlaying} bars={3} />
                <span className="now-card__time tabular">{formatTime(current.duration)}</span>
              </span>
            </span>
          </button>
        ) : (
          <div className="now-card now-card--empty">
            <span className="now-card__orb" aria-hidden="true">
              <Users size={18} />
            </span>
            <span className="now-card__meta">
              <span className="now-card__title">Nothing playing</span>
              <span className="now-card__handle">Pick a VoiceNote from the feed.</span>
            </span>
          </div>
        )}
      </section>
    </aside>
  );
}
