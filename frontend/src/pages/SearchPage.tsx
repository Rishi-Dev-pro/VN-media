import { Clock3, Compass, Radio } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/common/Avatar';
import { EmptyState } from '../components/common/EmptyState';
import { TagPill } from '../components/common/TagPill';
import { CommentsDrawer } from '../components/comments/CommentsDrawer';
import { AlbumCard } from '../components/search/AlbumCard';
import { CreatorResult } from '../components/search/CreatorResult';
import { SearchInput } from '../components/search/SearchInput';
import { SearchSuggestions } from '../components/search/SearchSuggestions';
import { FeedCard } from '../components/voiceNotes/FeedCard';
import type { VoiceNote } from '../data/types';
import { mockCreators } from '../data/mockCreators';
import { mockTagCatalog } from '../data/mockTags';
import type { Tag } from '../data/types';
import type { CreatorProfile } from '../services/creatorRepository';
import { useSearch } from '../hooks/useSearch';
import { isApiMode } from '../services/api/apiConfig';
import { createCreatorRepository } from '../services/creatorRepository';
import { createVoiceNoteRepository } from '../services/voiceNoteRepository';
import type { SearchFilter } from '../services/searchRepository';
import { formatCount } from '../utils/format';
import './SearchPage.css';

const TABS: { id: SearchFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'voiceNotes', label: 'VoiceNotes' },
  { id: 'creators', label: 'Creators' },
  { id: 'albums', label: 'Albums' },
  { id: 'tags', label: 'Tags' },
];

/** deterministic "trending" list for the discovery state (mock mode) */
const MOCK_TRENDING: Tag[] = [...mockTagCatalog].sort((a, b) => b.count - a.count).slice(0, 6);
const MOCK_SUGGESTED: CreatorProfile[] = [...mockCreators]
  .sort((a, b) => b.followers - a.followers)
  .slice(0, 4) as CreatorProfile[];

export default function SearchPage() {
  const search = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [commentsNote, setCommentsNote] = useState<VoiceNote | null>(null);

  // Real discovery state in API mode: suggested creators come from the real
  // creator repository and trending tags are aggregated from the real catalog
  // — mock identities/counts never appear in API mode.
  const [discovery, setDiscovery] = useState<{ trending: Tag[]; suggested: CreatorProfile[] }>(
    isApiMode
      ? { trending: [], suggested: [] }
      : { trending: MOCK_TRENDING, suggested: MOCK_SUGGESTED },
  );
  useEffect(() => {
    if (!isApiMode) return;
    let active = true;
    Promise.all([
      createVoiceNoteRepository().getTrending(),
      createCreatorRepository().getCreators(),
    ]).then(([notes, creators]) => {
      if (!active) return;
      const counts = new Map<string, number>();
      for (const n of notes) {
        for (const t of n.tags ?? []) {
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
      }
      const trending: Tag[] = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 6)
        .map(([name, count]) => ({ name, count }));
      setDiscovery({ trending, suggested: creators.slice(0, 4) });
    });
    return () => {
      active = false;
    };
  }, []);

  const { query, setQuery, filter, setFilter, status, results, suggestions } = search;

  const active = query.trim() !== '';
  const loading = status === 'loading';
  const failed = status === 'error';
  const stale = loading && results.total > 0;
  const showSkeletons = loading && !stale;
  const done = status === 'success';
  const total = results.total;

  // "/" focuses search when not already typing somewhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t instanceof HTMLInputElement ||
          t instanceof HTMLTextAreaElement ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const announce = useMemo(() => {
    if (!done) return null;
    if (total === 0) return `No results for ${query.trim()}`;
    return `${total} ${total === 1 ? 'result' : 'results'} for ${query.trim()}`;
  }, [done, total, query]);

  return (
    <div className="search-page">
      {/* ---- editorial header + field ---- */}
      <header className="search-head">
        <p className="search-head__eyebrow micro">✦&nbsp; Search</p>
        <h1 className="search-head__title">
          FIND
          <br />
          <span className="text-ghost">YOUR NEXT VOICE.</span>
        </h1>
        <p className="search-head__sub">A portal to everything worth hearing on VN-Media.</p>

        <div className="search-head__field">
          <SearchInput
            ref={inputRef}
            value={query}
            onChange={setQuery}
            onSubmit={() => search.commit(query)}
            onClear={() => {
              search.setQuery('');
              inputRef.current?.focus();
            }}
          />
          {/* suggestions live while typing; they yield to results once a search lands */}
          {status !== 'success' && status !== 'error' && (
            <SearchSuggestions query={query} results={suggestions} onPick={(q) => search.commit(q)} />
          )}
        </div>
      </header>

      {/* ---- active results: tabs + count ---- */}
      {active && (
        <div className="search-results-head">
          <div className="search-tabs" role="tablist" aria-label="Result categories">
            {TABS.map((t) => {
              const isActive = filter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`search-tabs__item ${isActive ? 'is-active' : ''}`}
                  onClick={() => setFilter(t.id)}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="search-results-head__count micro tabular">
            {loading && !stale ? 'searching…' : `${total} ${total === 1 ? 'result' : 'results'}`}
          </p>
        </div>
      )}

      <CommentsDrawer note={commentsNote} onClose={() => setCommentsNote(null)} />

      {/* ---- live region for assistive tech ---- */}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {/* ---- discovery state ---- */}
      {!active && !loading && !failed && (
        <DiscoveryState search={search} trending={discovery.trending} suggested={discovery.suggested} />
      )}

      {/* ---- error ---- */}
      {failed && (
        <EmptyState
          icon={<Radio />}
          title="Search interrupted."
          body={`Something went wrong while searching for "${query.trim()}".`}
          action={
            <button type="button" className="btn btn--primary" onClick={search.retry}>
              Try again
            </button>
          }
        />
      )}

      {/* ---- results ---- */}
      {active && !failed && (
        <div className={`search-results ${stale ? 'is-stale' : ''}`}>
          {showSkeletons ? (
            <ResultsSkeleton />
          ) : filter === 'all' ? (
            <AllResults search={search} onOpenComments={setCommentsNote} trending={discovery.trending} />
          ) : filter === 'voiceNotes' ? (
            <section aria-label="VoiceNote results">
              {results.voiceNotes.length > 0 ? (
                <div className="search-note-list">
                  {results.voiceNotes.map((n, i) => (
                    <FeedCard
                      key={n.id}
                      note={n}
                      queue={results.voiceNotes}
                      index={i}
                      onOpenComments={setCommentsNote}
                    />
                  ))}
                </div>
              ) : (
                <NoResults query={query} trending={discovery.trending} />
              )}
            </section>
          ) : filter === 'creators' ? (
            <section className="search-creator-list" aria-label="Creator results">
              {results.creators.length > 0 ? (
                results.creators.map((c) => <CreatorResult key={c.id} creator={c} query={query} />)
              ) : (
                <NoResults query={query} trending={discovery.trending} />
              )}
            </section>
          ) : filter === 'albums' ? (
            <section aria-label="Album results">
              {results.albums.length > 0 ? (
                <div className="search-album-grid">
                  {results.albums.map((a) => (
                    <AlbumCard key={a.id} album={a} query={query} />
                  ))}
                </div>
              ) : (
                <NoResults query={query} trending={discovery.trending} />
              )}
            </section>
          ) : (
            <section aria-label="Tag results">
              {results.tags.length > 0 ? (
                <div className="search-tag-grid">
                  {results.tags.map((t) => (
                    <TagPill key={t.name} name={t.name} count={t.count} onClick={() => search.commit(`#${t.name}`)} />
                  ))}
                </div>
              ) : (
                <NoResults query={query} trending={discovery.trending} />
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   DISCOVERY STATE
   ============================================================ */

function DiscoveryState({
  search,
  trending,
  suggested,
}: {
  search: ReturnType<typeof useSearch>;
  trending: Tag[];
  suggested: CreatorProfile[];
}) {
  return (
    <div className="search-discovery">
      <section className="search-disc-left" aria-label="Trending and recent">
        <div className="search-panel">
          <h2 className="search-panel__title micro">Trending now</h2>
          <ol className="trending-list">
            {trending.map((tag, i) => (
              <li key={tag.name}>
                <button
                  type="button"
                  className="trending-row"
                  onClick={() => search.commit(`#${tag.name}`)}
                >
                  <span className="trending-row__num tabular">{String(i + 1).padStart(2, '0')}</span>
                  <span className="trending-row__name">#{tag.name}</span>
                  <span className="trending-row__count tabular">{formatCount(tag.count)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {search.recent.length > 0 && (
          <div className="search-panel">
            <div className="search-panel__bar">
              <h2 className="search-panel__title micro">Recent searches</h2>
              <button type="button" className="search-panel__clear" onClick={search.clearRecent}>
                Clear all
              </button>
            </div>
            <ul className="search-recent">
              {search.recent.map((q) => (
                <li key={q} className="search-recent__row">
                  <button
                    type="button"
                    className="search-recent__main"
                    onClick={() => search.commit(q)}
                  >
                    <Clock3 size={14} aria-hidden="true" />
                    <span>{q}</span>
                  </button>
                  <button
                    type="button"
                    className="search-recent__remove"
                    aria-label={`Remove ${q} from recent searches`}
                    onClick={() => search.removeRecent(q)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="search-disc-right" aria-label="Suggested">
        <div className="search-panel">
          <h2 className="search-panel__title micro">Suggested creators</h2>
          <div className="search-suggest-creators">
            {suggested.map((c) => (
              <button
                key={c.id}
                type="button"
                className="search-suggest-creator"
                onClick={() => search.commit(`@${c.handle}`)}
              >
                <Avatar src={c.avatar} alt={c.name} size={40} />
                <span className="search-suggest-creator__meta">
                  <span className="search-suggest-creator__handle">@{c.handle}</span>
                  <span className="search-suggest-creator__count micro tabular">
                    {formatCount(c.followers)} followers
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   ALL TAB — grouped sections
   ============================================================ */

function AllResults({
  search,
  onOpenComments,
  trending,
}: {
  search: ReturnType<typeof useSearch>;
  onOpenComments: (note: VoiceNote) => void;
  trending: Tag[];
}) {
  const { results, query } = search;
  if (results.total === 0) return <NoResults query={query} trending={trending} />;

  return (
    <div className="search-all">
      {results.voiceNotes.length > 0 && (
        <section aria-label="Top VoiceNotes">
          <h2 className="search-section-title">VoiceNotes</h2>
          <div className="search-note-list">
            {results.voiceNotes.map((n, i) => (
              <FeedCard
                key={n.id}
                note={n}
                queue={results.voiceNotes}
                index={i}
                onOpenComments={onOpenComments}
              />
            ))}
          </div>
        </section>
      )}

      {results.creators.length > 0 && (
        <section aria-label="Creators">
          <h2 className="search-section-title">Creators</h2>
          <div className="search-creator-list">
            {results.creators.map((c) => (
              <CreatorResult key={c.id} creator={c} query={query} />
            ))}
          </div>
        </section>
      )}

      {results.albums.length > 0 && (
        <section aria-label="Albums">
          <h2 className="search-section-title">Albums</h2>
          <div className="search-album-grid">
            {results.albums.map((a) => (
              <AlbumCard key={a.id} album={a} query={query} />
            ))}
          </div>
        </section>
      )}

      {results.tags.length > 0 && (
        <section aria-label="Tags">
          <h2 className="search-section-title">Tags</h2>
          <div className="search-tag-grid">
            {results.tags.map((t) => (
              <TagPill key={t.name} name={t.name} count={t.count} onClick={() => search.commit(`#${t.name}`)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================================================
   NO RESULTS / SKELETON
   ============================================================ */

function NoResults({ query, trending }: { query: string; trending: Tag[] }) {
  return (
    <EmptyState
      icon={<Compass />}
      title="No signal here."
      body={`We couldn't find anything matching “${query.trim()}”.`}
      action={
        <>
          <div className="no-results__tags">
            {trending.slice(0, 3).map((t) => (
              <TagPill key={t.name} name={t.name} count={t.count} />
            ))}
          </div>
          <Link to="/discover" className="btn btn--ghost">
            Explore discover <span aria-hidden="true">→</span>
          </Link>
        </>
      }
    />
  );
}

function ResultsSkeleton() {
  return (
    <div aria-hidden="true" className="search-skeleton">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="feed-card feed-card--skeleton">
          <div className="skeleton feed-card__sk-art" />
          <div className="feed-card__sk-lines">
            <div className="skeleton feed-card__sk-line" style={{ width: '40%' }} />
            <div className="skeleton feed-card__sk-line" style={{ width: '64%' }} />
            <div className="skeleton feed-card__sk-line" style={{ width: '50%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
