import { getCreator } from '../../data/mockCreators';
import { voiceNotesById } from '../../data/mockVoiceNotes';
import { useParallax } from '../../hooks/useParallax';
import { formatTime } from '../../utils/format';
import { Equalizer } from '../common/Equalizer';

const track = voiceNotesById['vn-midnight-frequency'];

export default function AuthVisual() {
  const creator = getCreator(track.creatorId);
  const visualRef = useParallax<HTMLDivElement>();

  return (
    <div className="auth-visual" ref={visualRef} aria-hidden="true">
      <span className="auth-visual__glow" />
      <span className="auth-visual__glow auth-visual__glow--violet" />

      <figure className="auth-visual__frame">
        <img
          src="/images/hero-headphones-2.jpg"
          alt=""
          loading="eager"
        />
        <span className="auth-visual__notch" />
        <span className="auth-visual__scrim" />
        <figcaption className="auth-visual__chip micro">
          <span className="auth-visual__pulse" /> Your listening room
        </figcaption>
      </figure>

      <div className="auth-card-flt auth-card-flt--track">
        <div className="auth-card-flt__inner">
          <img src={track.cover} alt="" width={46} height={46} />
          <span className="auth-card-flt__meta">
            <span className="auth-card-flt__title">{track.title}</span>
            <span className="auth-card-flt__handle">
              @{creator.handle} · <span className="tabular">{formatTime(track.duration)}</span>
            </span>
          </span>
          <Equalizer playing bars={4} />
        </div>
      </div>

      <div className="auth-card-flt auth-card-flt--eq">
        <div className="auth-card-flt__inner auth-card-flt__inner--row">
          <span className="auth-eq" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="auth-card-flt__handle">night mode · 02:47</span>
        </div>
      </div>
    </div>
  );
}
