import { Heart, Play } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/common/Avatar';
import { Equalizer } from '../../components/common/Equalizer';
import { mockCreators } from '../../data/mockCreators';
import { voiceNotesById } from '../../data/mockVoiceNotes';
import { formatCount, formatTime } from '../../utils/format';
import type { CSSProperties } from 'react';

const PROOF_AVATARS = [
  mockCreators[0],
  mockCreators[1],
  mockCreators[3],
  mockCreators[6],
];

const track = voiceNotesById['vn-midnight-frequency'];

const delay = (d: string) => ({ '--d': d } as CSSProperties);

export default function LandingHero() {
  const heroRef = useRef<HTMLElement>(null);

  /* Subtle cursor-responsive parallax on the hero media object. */
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${(x * 16).toFixed(2)}px`);
        el.style.setProperty('--my', `${(y * 12).toFixed(2)}px`);
      });
    };
    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={heroRef} className="land-hero" aria-label="VN-Media introduction">
      <div className="land-hero__grid">
        <div className="land-hero__copy">
          <p className="land-hero__eyebrow micro land-rise" style={delay('0.05s')}>
            ✦&nbsp; The social audio network
          </p>

          <h1 className="land-hero__title">
            <span className="land-hero__line land-rise" style={delay('0.16s')}>
              VOICE
            </span>
            <span
              className="land-hero__line land-hero__line--ghost land-rise"
              style={delay('0.3s')}
            >
              WITHOUT
            </span>
            <span className="land-hero__line land-rise" style={delay('0.44s')}>
              LIMITS<span className="land-hero__dot">.</span>
            </span>
          </h1>

          <p className="land-hero__sub land-rise" style={delay('0.56s')}>
            Record a thought. Share a feeling. Discover the creators and
            sounds that make the world worth listening to.
          </p>

          <div className="land-hero__cta land-rise" style={delay('0.68s')}>
            <Link to="/discover" className="btn btn--primary btn--lg">
              Explore VN-Media <span aria-hidden="true">→</span>
            </Link>
            <Link to="/register" className="btn btn--ghost btn--lg">
              Create your account
            </Link>
          </div>

          <div className="land-hero__proof land-rise" style={delay('0.8s')}>
            <div className="land-hero__avatars">
              {PROOF_AVATARS.map((c) => (
                <Avatar key={c.id} src={c.avatar} alt={c.name} size={30} />
              ))}
            </div>
            <p className="land-hero__proof-text">
              <strong>240k+</strong> listeners · <strong>1.2M</strong> VoiceNotes
            </p>
          </div>
        </div>

        <div className="land-hero__visual land-rise" style={delay('0.42s')}>
          <div className="hero-visual">
            <span className="hero-visual__glow" aria-hidden="true" />

            <div className="hero-visual__frame">
              <img
                src="/images/hero-headphones.jpg"
                alt="A listener wearing headphones in warm, cinematic light"
              />
              <span className="hero-visual__scrim" aria-hidden="true" />
              <span className="hero-visual__notch" aria-hidden="true" />
              <span className="hero-visual__chip micro">Now playing</span>
            </div>

            <div className="hero-card hero-card--track">
              <div className="hero-card__float">
                <img src={track.cover} alt="" />
                <div className="hero-card__meta">
                  <span className="hero-card__title">{track.title}</span>
                  <span className="hero-card__handle">
                    @{mockCreators.find((c) => c.id === track.creatorId)?.handle}
                    {' · '}
                    <span className="tabular">{formatTime(track.duration)}</span>
                  </span>
                </div>
                <Equalizer playing className="hero-card__eq" />
                <span className="hero-card__play" aria-hidden="true">
                  <Play size={15} fill="currentColor" />
                </span>
              </div>
            </div>

            <div className="hero-card hero-card--like">
              <div className="hero-card__float hero-card__float--like">
                <span className="hero-card__like-icon" aria-hidden="true">
                  <Heart size={13} fill="currentColor" />
                </span>
                <span className="hero-card__like-num tabular">{formatCount(track.likes)}</span>
                <span className="hero-card__like-label">likes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
