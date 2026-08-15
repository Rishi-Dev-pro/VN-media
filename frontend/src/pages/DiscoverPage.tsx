import { Compass } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CommentsDrawer } from '../components/comments/CommentsDrawer';
import { EmptyState } from '../components/common/EmptyState';
import { TagPill } from '../components/common/TagPill';
import { FeaturedPlayer } from '../components/player/FeaturedPlayer';
import { FeaturedCard } from '../components/voiceNotes/FeaturedCard';
import { TrackRow } from '../components/voiceNotes/TrackRow';
import { mockTrendingTags } from '../data/mockTags';
import type { Tag, VoiceNote } from '../data/types';
import { isApiMode } from '../services/api/apiConfig';
import { useVoiceNotes } from '../hooks/useVoiceNotes';
import { usePlayer } from '../state/PlayerContext';
import './DiscoverPage.css';

const ROTATIONS = [1.2, -0.8, 0.6];

export default function DiscoverPage() {
  const { featured, trending, recentlyPlayed, loading, error, retry } = useVoiceNotes();
  const { current, select } = usePlayer();
  const [commentsNote, setCommentsNote] = useState<VoiceNote | null>(null);

  // API mode: trending tags are aggregated from the real catalog so mock
  // counts/identities never appear (mock mode keeps the static showcase set).
  // Derived from the trending notes the hook already loads, so it refreshes
  // with the retry lifecycle instead of a separate one-shot fetch.
  const trendingTags = useMemo<Tag[]>(() => {
    if (!isApiMode) return mockTrendingTags;
    const counts = new Map<string, number>();
    for (const n of trending) {
      for (const t of n.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [trending]);

  // Pre-select the first featured VoiceNote once loaded (without autoplay)
  // so the featured player is always populated.
  useEffect(() => {
    if (!current && featured.length > 0) select(featured[0], featured);
  }, [featured, current, select]);

  const playerNote = current ?? featured[0];

  if (error) {
    return (
      <div className="discover">
        <section className="featured-sec" aria-label="Featured VoiceNotes">
          <header className="section-head">
            <div>
              <h2 className="section-head__title">Featured</h2>
              <p className="section-head__sub">Curated for tonight</p>
            </div>
          </header>
          <div className="creators-error" role="alert">
            <h2>SIGNAL LOST.</h2>
            <p>This listening room couldn’t be reached.</p>
            <button type="button" className="btn btn--ghost" onClick={retry}>
              TRY AGAIN
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="discover">
      {/* ---- featured ---- */}
      <section className="featured-sec" aria-label="Featured VoiceNotes">
        <header className="section-head">
          <div>
            <h2 className="section-head__title">Featured</h2>
            <p className="section-head__sub">Curated for tonight</p>
          </div>
          <span className="section-head__meta micro">
            {loading ? '—' : `${featured.length} picks`}
          </span>
        </header>

        {loading ? (
          <div className="featured-stack" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`featured-card featured-card--skeleton ${i > 0 ? 'featured-card--cascade' : ''}`}
              >
                <div className="skeleton featured-card__sk-art" />
                <div className="featured-card__sk-foot">
                  <div className="skeleton featured-card__sk-line" style={{ width: '55%' }} />
                  <div className="skeleton featured-card__sk-line" style={{ width: '38%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <EmptyState
            icon={<Compass />}
            title="Nothing featured yet"
            body="New VoiceNotes will appear here as creators publish."
          />
        ) : (
          <div className="featured-stack">
            {featured.map((note, i) => (
              <FeaturedCard
                key={note.id}
                note={note}
                queue={featured}
                rotation={ROTATIONS[i % ROTATIONS.length]}
                cascade={i > 0}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---- featured player ---- */}
      <aside className="player-sec" aria-label="Featured player">
        {loading ? (
          <div className="player-skeleton" aria-hidden="true">
            <div className="skeleton player-skeleton__art" />
            <div className="skeleton player-skeleton__line" style={{ width: '70%' }} />
            <div className="skeleton player-skeleton__line" style={{ width: '40%' }} />
            <div className="skeleton player-skeleton__bar" />
          </div>
        ) : playerNote ? (
          <FeaturedPlayer note={playerNote} onOpenComments={setCommentsNote} />
        ) : (
          <EmptyState icon={<Compass />} title="Choose a VoiceNote" />
        )}
      </aside>

      {/* ---- trending tags ---- */}
      <section className="tags-sec" aria-label="Trending tags">
        <header className="section-head">
          <h2 className="section-head__title">Trending now</h2>
        </header>
        <div className="tags-row no-scrollbar">
          {trendingTags.map((tag) => (
            <TagPill key={tag.name} name={tag.name} count={tag.count} />
          ))}
        </div>
      </section>

      {/* ---- recently played ---- */}
      <section className="recent-sec" aria-label="Recently played">
        <header className="section-head">
          <div>
            <h2 className="section-head__title">Recently played</h2>
            <p className="section-head__sub">Pick up where you left off</p>
          </div>
          <button type="button" className="text-link">
            See all <span aria-hidden="true">→</span>
          </button>
        </header>

        {loading ? (
          <ul className="recent-list" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="track-row track-row--skeleton">
                <div className="skeleton track-row__sk-art" />
                <div className="track-row__sk-meta">
                  <div className="skeleton track-row__sk-line" style={{ width: '52%' }} />
                  <div className="skeleton track-row__sk-line" style={{ width: '30%' }} />
                </div>
              </li>
            ))}
          </ul>
        ) : recentlyPlayed.length === 0 ? (
          <EmptyState
            icon={<Compass />}
            title="Nothing played yet"
            body="Your listening history will appear here."
          />
        ) : (
          <ul className="recent-list">
            {recentlyPlayed.map((note) => (
              <TrackRow
                key={note.id}
                note={note}
                queue={recentlyPlayed}
                onOpenComments={setCommentsNote}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ---- trending strip ---- */}
      <section className="trending-sec" aria-label="More from trending">
        <header className="section-head">
          <h2 className="section-head__title">More from trending</h2>
        </header>
        <div className="trending-strip no-scrollbar">
          {trending.map((note) => (
            <TrendingChip key={note.id} note={note} />
          ))}
        </div>
      </section>

      <CommentsDrawer note={commentsNote} onClose={() => setCommentsNote(null)} />
    </div>
  );
}

function TrendingChip({ note }: { note: { id: string; title: string; cover: string } }) {
  return (
    <button type="button" className="trending-chip">
      <img src={note.cover} alt="" loading="lazy" width={40} height={40} />
      <span className="trending-chip__title">{note.title}</span>
    </button>
  );
}
