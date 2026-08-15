import { Activity, Gauge, HardDriveDownload } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FeaturedCard } from '../../components/voiceNotes/FeaturedCard';
import { Equalizer } from '../../components/common/Equalizer';
import { PlayerControls } from '../../components/player/PlayerControls';
import { getCreator } from '../../data/mockCreators';
import { voiceNotesById } from '../../data/mockVoiceNotes';
import { isApiMode } from '../../services/api/apiConfig';
import { useVoiceNotes } from '../../hooks/useVoiceNotes';
import { usePlayer } from '../../state/PlayerContext';
import { formatTime } from '../../utils/format';
import type { CSSProperties } from 'react';

/* deterministic waveform heights (%) */
const WAVE = [
  10, 16, 24, 32, 40, 34, 26, 18, 12, 22, 30, 38, 46, 40, 32, 24, 16, 10, 20, 30,
  40, 50, 42, 34, 26, 18, 12, 24, 36, 44, 38, 30, 22, 14, 8, 18, 28, 38, 30, 22,
];

function Waveform({ playing }: { playing: boolean }) {
  return (
    <span className={`wave ${playing ? 'is-playing' : ''}`} aria-hidden="true">
      {WAVE.map((h, i) => (
        <span
          key={i}
          className="wave__bar"
          style={{ height: `${h}%`, animationDelay: `${(i % 10) * 90}ms` }}
        />
      ))}
    </span>
  );
}

const rot = (d: string) => ({ '--rot': d } as CSSProperties);

/* ---------------- Section 2 — Discover preview ---------------- */

function DiscoverPreview() {
  const navigate = useNavigate();
  const { featured, loading } = useVoiceNotes();

  return (
    <section className="land-section" id="discover">
      <header className="land-section__head">
        <div>
          <span className="land-section__index micro">01 — Discover</span>
          <h2 className="land-section__title">
            FIND SOMETHING
            <br />
            <span className="land-section__ghost">WORTH HEARING.</span>
          </h2>
        </div>
        <p className="land-section__sub">
          Featured VoiceNotes, trending voices and new uploads — a listening
          room curated for how you feel tonight.
        </p>
      </header>

      <div className="discover-preview">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="skeleton discover-preview__sk" />
          ))
        ) : (
          <>
            <div className="discover-preview__lead">
              {featured[0] && (
                <FeaturedCard
                  note={featured[0]}
                  queue={featured}
                  rotation={1.1}
                  onActivate={() => navigate('/discover')}
                />
              )}
            </div>
            <div className="discover-preview__stack">
              {featured.slice(1, 3).map((note, i) => (
                <FeaturedCard
                  key={note.id}
                  note={note}
                  queue={featured}
                  rotation={i === 0 ? -1 : 0.8}
                  onActivate={() => navigate('/discover')}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="land-section__cta">
        <Link to="/discover" className="btn btn--ghost">
          Explore Discover <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

/* ---------------- Section 3 — The Voice ---------------- */

const VOICE_CARDS = [
  { creatorId: 'crea-luna', noteId: 'vn-midnight-frequency', rot: -1.6, offset: 's' },
  { creatorId: 'crea-aria', noteId: 'vn-neon-bloom', rot: 1.4, offset: 'm' },
  { creatorId: 'crea-nocturne', noteId: 'vn-static-dreams', rot: -0.8, offset: 'l' },
  { creatorId: 'crea-elio', noteId: 'vn-slow-hours', rot: 1.2, offset: 'l' },
  { creatorId: 'crea-marcus', noteId: 'vn-paper-satellites', rot: -1.2, offset: 's' },
  { creatorId: 'crea-ivy', noteId: 'vn-after-rain', rot: 0.7, offset: 'm' },
];

function TheVoice() {
  return (
    <section className="land-section" id="voice">
      <header className="land-section__head">
        <div>
          <span className="land-section__index micro">02 — The voice</span>
          <h2 className="land-section__title">
            NOT JUST AUDIO.
            <br />
            <span className="land-section__ghost">PEOPLE. STORIES. PERSPECTIVES.</span>
          </h2>
        </div>
        <p className="land-section__sub">
          Behind every waveform is a human. VN-Media is built around the
          people who press record — their rooms, their voices, their hours.
        </p>
      </header>

      <div className="voice-collage">
        {VOICE_CARDS.map(({ creatorId, noteId, rot: r, offset }) => {
          const creator = getCreator(creatorId);
          const note = voiceNotesById[noteId];
          return (
            <article
              key={creatorId}
              className={`voice-card voice-card--${offset}`}
              style={rot(`${r}deg`)}
            >
              <div className="voice-card__art">
                <img src={creator.avatar} alt={creator.name} loading="lazy" />
                <span className="voice-card__scrim" aria-hidden="true" />
                <span className="voice-card__chip micro">
                  {note.category} · <span className="tabular">{formatTime(note.duration)}</span>
                </span>
              </div>
              <div className="voice-card__meta">
                <span className="voice-card__handle">@{creator.handle}</span>
                <span className="voice-card__name">{creator.name}</span>
                <span className="voice-card__track">“{note.title}”</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Section 4 — Listening showcase ---------------- */

const SHOWCASE_NOTE = voiceNotesById['vn-neon-bloom'];

function Listening() {
  const { current, select } = usePlayer();
  const creator = getCreator(SHOWCASE_NOTE.creatorId);
  const playing = current?.id === SHOWCASE_NOTE.id;

  // Static showcase only — never inject the mock note into the global
  // player in API mode (that would leak a mock note into real state).
  useEffect(() => {
    if (isApiMode) return;
    if (!current) select(SHOWCASE_NOTE, [SHOWCASE_NOTE]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="land-section land-section--listen" id="listen">
      <header className="land-section__head">
        <div>
          <span className="land-section__index micro">03 — The experience</span>
          <h2 className="land-section__title">
            MADE TO BE
            <br />
            <span className="land-section__ghost">LISTENED TO.</span>
          </h2>
        </div>
        <p className="land-section__sub">
          A player that disappears when you’re in the moment — and stays with
          you everywhere you go.
        </p>
      </header>

      <div className="listen-showcase">
        <div className="listen-player">
          <div className="listen-player__art">
            <img src={SHOWCASE_NOTE.cover} alt={`Artwork for ${SHOWCASE_NOTE.title}`} />
            <span className="listen-player__scrim" aria-hidden="true" />
            <span className="listen-player__chip micro">
              <Activity size={10} aria-hidden="true" /> Now playing
            </span>
            <span className="listen-player__eq">
              <Equalizer playing={!!playing} bars={5} />
            </span>
          </div>

          <div className="listen-player__body">
            <h3 className="listen-player__title">{SHOWCASE_NOTE.title}</h3>
            <p className="listen-player__handle">@{creator.handle}</p>
            <PlayerControls size="lg" />
          </div>
        </div>

        <div className="listen-side">
          <Waveform playing={!!playing} />
          <ul className="listen-points">
            <li>
              <span className="listen-points__icon"><Gauge size={16} /></span>
              <div>
                <strong>Precise control</strong>
                <span>Playback speed from 0.5× to 2×, scrubbed by waveform.</span>
              </div>
            </li>
            <li>
              <span className="listen-points__icon"><HardDriveDownload size={16} /></span>
              <div>
                <strong>Offline library</strong>
                <span>Save VoiceNotes and take them anywhere.</span>
              </div>
            </li>
            <li>
              <span className="listen-points__icon"><Activity size={16} /></span>
              <div>
                <strong>Continuous playback</strong>
                <span>The player follows you across every page.</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function LandingSections() {
  return (
    <>
      <DiscoverPreview />
      <TheVoice />
      <Listening />
    </>
  );
}
