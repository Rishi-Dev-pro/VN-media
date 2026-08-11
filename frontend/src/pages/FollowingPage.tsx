import { Check, ChevronDown, Compass, Radio, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CirclePanel } from '../components/following/CirclePanel';
import { CreatorRail } from '../components/following/CreatorRail';
import { CommentsDrawer } from '../components/comments/CommentsDrawer';
import { FeedCard } from '../components/voiceNotes/FeedCard';
import { EmptyState } from '../components/common/EmptyState';
import type { VoiceNote } from '../data/types';
import { getCreator } from '../data/mockCreators';
import { DEMO_LISTENER } from '../data/mockFollowing';
import { useFollowing, type FeedFilter, type FeedSort } from '../hooks/useFollowing';
import { formatCount } from '../utils/format';
import './FollowingPage.css';

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recent', label: 'Recent' },
  { id: 'creators', label: 'Creators' },
];

export default function FollowingPage() {
  const {
    creators,
    loading,
    error,
    retry,
    followingIds,
    toggleFollow,
    filter,
    setFilter,
    sort,
    setSort,
    selectedCreator,
    selectCreator,
    visibleNotes,
    newThisWeek,
  } = useFollowing();

  const [commentsNote, setCommentsNote] = useState<VoiceNote | null>(null);

  const selectedCreatorObj = useMemo(
    () => (selectedCreator ? getCreator(selectedCreator) : null),
    [selectedCreator],
  );

  const shownCreators = useMemo(
    () => creators.filter((c) => followingIds.has(c.id)),
    [creators, followingIds],
  );

  return (
    <div className="following">
      {/* ---- editorial header ---- */}
      <header className="following-head">
        <div>
          <p className="following-head__eyebrow micro">✦&nbsp; Following</p>
          <h1 className="following-head__title">
            YOUR CIRCLE.
            <br />
            <span className="text-ghost">YOUR SOUND.</span>
          </h1>
          <p className="following-head__sub">
            Stay close to the voices that matter to you.
          </p>
        </div>
        <div className="following-head__listener" aria-label="Demo listener">
          <span className="following-head__listener-dot" aria-hidden="true" />
          <span>
            Listening as <strong>@{DEMO_LISTENER.handle}</strong>
          </span>
        </div>
      </header>

      {/* ---- creator rail ---- */}
      <section className="following-rail-sec" aria-label="People you follow">
        <div className="following-sec-title">
          <h2 className="following-sec-title__text">
            <Users size={15} aria-hidden="true" /> People you follow
          </h2>
          {!loading && !error && (
            <span className="following-sec-title__meta micro">
              {shownCreators.length} of {creators.length} creators
            </span>
          )}
        </div>

        {loading ? (
          <div className="creator-rail creator-rail--skeleton" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="creator-cell creator-cell--sk">
                <div className="skeleton creator-cell__sk-avatar" />
                <div className="skeleton creator-cell__sk-line" style={{ width: '70%' }} />
                <div className="skeleton creator-cell__sk-line" style={{ width: '45%' }} />
              </div>
            ))}
          </div>
        ) : (
          <CreatorRail
            creators={creators}
            followingIds={followingIds}
            selected={selectedCreator}
            onSelect={selectCreator}
            onToggleFollow={toggleFollow}
          />
        )}
      </section>

      {/* ---- filters + feed ---- */}
      <section className="following-feed-sec" aria-label="Feed from your circle">
        <div className="following-feed-bar">
          <div className="seg" role="tablist" aria-label="Feed filters">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`seg__item ${active ? 'is-active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <SortMenu sort={sort} onSort={setSort} />

          {selectedCreatorObj ? (
            <button
              type="button"
              className="following-filter-chip"
              onClick={() => selectCreator(null)}
              aria-label="Clear creator filter"
            >
              All from @{selectedCreatorObj.handle}
              <X size={13} aria-hidden="true" />
            </button>
          ) : (
            <span className="following-feed-count micro tabular">
              {visibleNotes.length} notes
            </span>
          )}
        </div>

        {/* ---- states ---- */}
        {error ? (
          <EmptyState
            icon={<Radio />}
            title="We lost the signal."
            body="Something went wrong while loading your circle."
            action={
              <button type="button" className="btn btn--primary" onClick={retry}>
                Try again
              </button>
            }
          />
        ) : loading ? (
          <div className="following-feed-list" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="feed-card feed-card--skeleton">
                <div className="skeleton feed-card__sk-art" />
                <div className="feed-card__sk-lines">
                  <div className="skeleton feed-card__sk-line" style={{ width: '34%' }} />
                  <div className="skeleton feed-card__sk-line" style={{ width: '62%' }} />
                  <div className="skeleton feed-card__sk-line" style={{ width: '48%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filter === 'creators' ? (
          <CreatorGrid
            creators={creators}
            followingIds={followingIds}
            onToggleFollow={toggleFollow}
            onOpen={(id) => {
              selectCreator(id);
              setFilter('all');
            }}
          />
        ) : visibleNotes.length === 0 ? (
          <FeedEmpty
            hasFollowing={shownCreators.length > 0}
            selectedHandle={selectedCreatorObj?.handle ?? null}
            onFollowBack={
              selectedCreator
                ? () => toggleFollow(selectedCreator)
                : undefined
            }
          />
        ) : (
          <div className="following-feed-list">
            {visibleNotes.map((note, i) => (
              <FeedCard
                key={note.id}
                note={note}
                queue={visibleNotes}
                index={i}
                onOpenComments={setCommentsNote}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---- side panel ---- */}
      <CirclePanel
        followingCount={followingIds.size}
        newThisWeek={newThisWeek}
        feedCount={visibleNotes.length}
      />

      <CommentsDrawer note={commentsNote} onClose={() => setCommentsNote(null)} />
    </div>
  );
}

/* ---------- sort control ---------- */

const SORTS: { id: FeedSort; label: string }[] = [
  { id: 'latest', label: 'Latest' },
  { id: 'liked', label: 'Most liked' },
  { id: 'played', label: 'Recently played' },
];

function SortMenu({ sort, onSort }: { sort: FeedSort; onSort: (s: FeedSort) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = SORTS.find((s) => s.id === sort)?.label ?? 'Latest';

  return (
    <div ref={rootRef} className="sort-menu">
      <button
        type="button"
        className="sort-menu__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div className="sort-menu__pop" role="listbox" aria-label="Sort the feed">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={sort === s.id}
              className={`sort-menu__item ${sort === s.id ? 'is-active' : ''}`}
              onClick={() => {
                onSort(s.id);
                setOpen(false);
              }}
            >
              <span>{s.label}</span>
              {sort === s.id && <Check size={13} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- creator grid (CREATORS tab) ---------- */

function CreatorGrid({
  creators,
  followingIds,
  onToggleFollow,
  onOpen,
}: {
  creators: { id: string; handle: string; name: string; avatar: string; bio: string; tint: string; followers: number }[];
  followingIds: Set<string>;
  onToggleFollow: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="creator-grid">
      {creators.map((creator, i) => {
        const followed = followingIds.has(creator.id);
        return (
          <article
            key={creator.id}
            className="creator-card"
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
          >
            <button
              type="button"
              className="creator-card__open"
              aria-label={`Show everything from ${creator.name}`}
              onClick={() => onOpen(creator.id)}
            >
              <span
                className="creator-card__avatar"
                style={{ ['--tint' as string]: creator.tint }}
              >
                <img src={creator.avatar} alt="" loading="lazy" width={64} height={64} />
              </span>
              <span className="creator-card__handle">@{creator.handle}</span>
              <span className="creator-card__name">{creator.name}</span>
            </button>
            <p className="creator-card__bio">{creator.bio}</p>
            <div className="creator-card__foot">
              <span className="creator-card__followers micro tabular">
                {formatCount(creator.followers)} followers
              </span>
              <button
                type="button"
                className={`follow-pill ${followed ? 'is-following' : ''}`}
                aria-pressed={followed}
                aria-label={followed ? `Unfollow ${creator.name}` : `Follow ${creator.name}`}
                onClick={() => onToggleFollow(creator.id)}
              >
                {followed ? 'Following' : 'Follow'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ---------- empty states ---------- */

function FeedEmpty({
  hasFollowing,
  selectedHandle,
  onFollowBack,
}: {
  hasFollowing: boolean;
  selectedHandle: string | null;
  onFollowBack?: () => void;
}) {
  if (selectedHandle && !hasFollowing) {
    return (
      <EmptyState
        icon={<Users />}
        title="This feed is quiet."
        body={`Follow @${selectedHandle} to see their voices here.`}
        action={
          <button type="button" className="btn btn--primary" onClick={onFollowBack}>
            Follow @{selectedHandle}
          </button>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={<Compass />}
      title="Your circle is quiet."
      body="Follow creators whose voices you want to hear here."
      action={
        <Link to="/discover" className="btn btn--primary">
          Discover voices <span aria-hidden="true">→</span>
        </Link>
      }
    />
  );
}

