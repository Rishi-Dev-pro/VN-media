import { Check, Mic2, Search, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreatorCard } from '../components/creators/CreatorCard';
import { FeaturedCreator } from '../components/creators/FeaturedCreator';
import { EmptyState } from '../components/common/EmptyState';
import { useCreators } from '../hooks/useCreators';
import type { CreatorProfile } from '../services/creatorRepository';
import { useFollows } from '../state/FollowContext';
import { formatCount } from '../utils/format';
import './CreatorsPage.css';

const delay = (s: string) => ({ animationDelay: s });

type CreatorSort = 'all' | 'trending' | 'followed' | 'active';

const SORTS: { id: CreatorSort; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending' },
  { id: 'followed', label: 'Most followed' },
  { id: 'active', label: 'Most active' },
];

/** Creators who joined within roughly the last two months (mock). */
const NEW_CUTOFF = Date.parse('2026-06-01T00:00:00Z');

export default function CreatorsPage() {
  const { creators, featured, loading, error, retry } = useCreators();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CreatorSort>('all');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = creators;
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          c.bio.toLowerCase().includes(q),
      );
    }
    if (sort === 'trending') {
      list = [...list].sort((a, b) => b.totalPlays - a.totalPlays);
    } else if (sort === 'followed') {
      list = [...list].sort((a, b) => b.followers - a.followers);
    } else if (sort === 'active') {
      list = [...list].sort((a, b) => b.voiceNoteCount - a.voiceNoteCount);
    }
    return list;
  }, [creators, query, sort]);

  const trending = useMemo(
    () => [...creators].sort((a, b) => b.totalPlays - a.totalPlays).slice(0, 6),
    [creators],
  );

  const newCreators = useMemo(
    () =>
      creators
        .filter((c) => Date.parse(c.joinedAt) >= NEW_CUTOFF)
        .sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt))
        .slice(0, 4),
    [creators],
  );

  const searching = query.trim().length > 0;

  return (
    <div className="creators-page">
      {/* ---- editorial header ---- */}
      <header className="creators-head">
        <div>
          <p className="creators-head__eyebrow micro land-rise" style={delay('0.05s')}>
            ✦&nbsp; Creators
          </p>
          <h1 className="creators-head__title land-rise" style={delay('0.12s')}>
            THE VOICES BEHIND
            <br />
            <span className="text-ghost">THE STORIES.</span>
          </h1>
          <p className="creators-head__sub land-rise" style={delay('0.24s')}>
            Meet the people shaping the sound of VN-Media.
          </p>
        </div>
        <div className="creators-head__count micro land-rise" style={delay('0.3s')} aria-label="Creator count">
          {loading ? '—' : `${creators.length} creators`}
        </div>
      </header>

      {/* ---- featured creator ---- */}
      <section className="creators-featured-sec" aria-label="Featured creator">
        {loading ? (
          <div className="featured-creator featured-creator--skeleton" aria-hidden="true">
            <div className="featured-creator__media">
              <div className="skeleton featured-creator__sk-frame" />
            </div>
            <div className="featured-creator__body">
              <div className="skeleton creators-sk-line" style={{ width: '36%' }} />
              <div className="skeleton creators-sk-line" style={{ width: '68%', height: 34 }} />
              <div className="skeleton creators-sk-line" style={{ width: '90%' }} />
              <div className="skeleton creators-sk-line" style={{ width: '58%' }} />
            </div>
          </div>
        ) : error ? (
          <div className="creators-error" role="alert">
            <h2>WE LOST THE SIGNAL.</h2>
            <p>Something went wrong while loading creators.</p>
            <button type="button" className="btn btn--ghost" onClick={retry}>
              Try again
            </button>
          </div>
        ) : featured ? (
          <FeaturedCreator creator={featured} />
        ) : (
          <EmptyState
            icon={<Mic2 />}
            title="No creators yet"
            body="Voices will appear here as the community grows."
          />
        )}
      </section>

      {/* ---- discover grid ---- */}
      <section className="creators-grid-sec" aria-label="Discover creators">
        <header className="creators-toolbar">
          <div className="creators-toolbar__head">
            <div>
              <h2 className="section-head__title">Discover creators</h2>
              <p className="section-head__sub">Search names, handles, and what they make</p>
            </div>
            <span className="section-head__meta micro">
              {loading ? '—' : `${visible.length} ${visible.length === 1 ? 'creator' : 'creators'}`}
            </span>
          </div>

          <div className="creators-toolbar__row">
            <div className="creators-search" role="search">
              <Search size={16} aria-hidden="true" className="creators-search__icon" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search creators…"
                aria-label="Search creators"
                maxLength={80}
              />
              {query && (
                <button
                  type="button"
                  className="creators-search__clear"
                  aria-label="Clear creator search"
                  onClick={() => setQuery('')}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="creators-sorts no-scrollbar" role="group" aria-label="Sort creators">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`creators-sorts__btn ${sort === s.id ? 'is-active' : ''}`}
                  aria-pressed={sort === s.id}
                  onClick={() => setSort(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="creators-grid" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="creator-card creator-card--skeleton">
                <div className="skeleton creator-card__sk-portrait" />
                <div className="skeleton creators-sk-line" style={{ width: '62%' }} />
                <div className="skeleton creators-sk-line" style={{ width: '40%' }} />
              </div>
            ))}
          </div>
        ) : error ? null : searching && visible.length === 0 ? (
          <div className="creators-nothing">
            <p className="creators-nothing__title">NO CREATORS FOUND.</p>
            <p className="creators-nothing__sub">Try another name, handle, or phrase.</p>
            <button type="button" className="btn btn--ghost" onClick={() => setQuery('')}>
              Reset search
            </button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Mic2 />}
            title="No creators here yet"
            body="New voices will appear here as they join VN-Media."
          />
        ) : (
          <div className="creators-grid">
            {visible.map((creator, i) => (
              <CreatorCard key={creator.id} creator={creator} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* ---- trending voices strip ---- */}
      {!loading && !error && !searching && (
        <section className="creators-strip-sec" aria-label="Trending voices">
          <header className="section-head">
            <div>
              <h2 className="section-head__title">Trending voices</h2>
              <p className="section-head__sub">The most played right now</p>
            </div>
          </header>
          <div className="creators-strip no-scrollbar">
            {trending.map((creator, i) => (
              <TrendingCell key={creator.id} creator={creator} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ---- new creators ---- */}
      {!loading && !error && !searching && newCreators.length > 0 && (
        <section className="creators-new-sec" aria-label="New creators">
          <header className="section-head">
            <div>
              <h2 className="section-head__title">New creators</h2>
              <p className="section-head__sub">Recently joined and worth a listen</p>
            </div>
          </header>
          <div className="creators-grid creators-grid--new">
            {newCreators.map((creator, i) => (
              <CreatorCard key={creator.id} creator={creator} index={i} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Compact horizontal strip cell for trending creators. */
function TrendingCell({ creator, index }: { creator: CreatorProfile; index: number }) {
  const navigate = useNavigate();
  const { isFollowing, toggleFollow } = useFollows();
  const followed = isFollowing(creator.id);

  const open = useCallback(() => {
    navigate(`/creators/${creator.handle}`);
  }, [creator.handle, navigate]);

  return (
    <article
      className="trending-cell"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      aria-label={`${creator.name} — @${creator.handle}, open profile`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span className="trending-cell__avatar">
        <img src={creator.avatar} alt="" loading="lazy" width={72} height={72} />
        <span className="trending-cell__rank tabular" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
      </span>
      <span className="trending-cell__name">{creator.name}</span>
      <span className="trending-cell__handle">@{creator.handle}</span>
      <span className="trending-cell__followers micro tabular">
        {formatCount(creator.followers)} followers
      </span>
      <button
        type="button"
        className={`follow-pill ${followed ? 'is-following' : ''}`}
        aria-pressed={followed}
        aria-label={followed ? `Unfollow ${creator.name}` : `Follow ${creator.name}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleFollow(creator.id);
        }}
      >
        {followed ? <Check size={12} aria-hidden="true" /> : null}
        {followed ? 'Following' : 'Follow'}
      </button>
    </article>
  );
}
