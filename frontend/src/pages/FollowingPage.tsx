import {
  Check,
  ChevronDown,
  Compass,
  Radio,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CirclePanel } from '../components/following/CirclePanel';
import { ContinueListening } from '../components/following/ContinueListening';
import { CreatorRail } from '../components/following/CreatorRail';
import { YouMayLike } from '../components/following/YouMayLike';
import { CommentsDrawer } from '../components/comments/CommentsDrawer';
import { EmptyState } from '../components/common/EmptyState';
import { FeaturedCard } from '../components/voiceNotes/FeaturedCard';
import { FeedCard } from '../components/voiceNotes/FeedCard';
import { mockAlbums } from '../data/mockAlbums';
import type { VoiceNote } from '../data/types';
import { getListener } from '../services/api/identity';
import { useFollowing, type FeedFilter, type FeedSort } from '../hooks/useFollowing';
import { formatCount } from '../utils/format';
import './FollowingPage.css';

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'albums', label: 'Albums' },
  { id: 'creators', label: 'Creators' },
];

const SORTS: { id: FeedSort; label: string }[] = [
  { id: 'latest', label: 'Latest' },
  { id: 'liked', label: 'Most liked' },
  { id: 'played', label: 'Most listened' },
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
    visibleNotes,
    featuredNote,
    recentlyPlayed,
    newThisWeek,
  } = useFollowing();

  const [commentsNote, setCommentsNote] = useState<VoiceNote | null>(null);

  // rail = followed creators only (the social graph's followed set)
  const shownCreators = useMemo(
    () => creators.filter((c) => followingIds.has(c.id)),
    [creators, followingIds],
  );

  // deterministic recommendations: not followed, sorted by popularity
  const suggestions = useMemo(
    () =>
      creators
        .filter((c) => !followingIds.has(c.id))
        .sort((a, b) => b.followers - a.followers)
        .slice(0, 4),
    [creators, followingIds],
  );

  // noteId -> public album it belongs to (for the From-album chip)
  const albumByNote = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    for (const a of mockAlbums) {
      if ((a.visibility ?? 'public') !== 'public') continue;
      for (const vid of a.voiceNoteIds) {
        if (!map.has(vid)) map.set(vid, { id: a.id, title: a.title });
      }
    }
    return map;
  }, []);

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
            Your latest sounds from the people you listen to.
          </p>
        </div>
        <div className="following-head__listener" aria-label="Demo listener">
          <span className="following-head__listener-dot" aria-hidden="true" />
          <span>
            Listening as <strong>@{getListener().handle}</strong>
          </span>
        </div>
      </header>

      {/* ---- creator rail (followed only) ---- */}
      <section className="following-rail-sec" aria-label="People you follow">
        <div className="following-sec-title">
          <h2 className="following-sec-title__text">
            <Users size={15} aria-hidden="true" /> Your voices
          </h2>
          {!loading && !error && (
            <span className="following-sec-title__meta micro">
              {shownCreators.length} {shownCreators.length === 1 ? 'creator' : 'creators'} in your circle
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
            creators={shownCreators}
            followingIds={followingIds}
            onToggleFollow={toggleFollow}
          />
        )}
      </section>

      {/* ---- feed column ---- */}
      <section className="following-feed-sec" aria-label="Feed from your circle">
        {/* featured new voice */}
        {!loading && !error && filter === 'all' && featuredNote && (
          <div className="following-featured">
            <div className="following-sec-title">
              <h2 className="following-sec-title__text">
                <Sparkles size={15} aria-hidden="true" /> New from your circle
              </h2>
            </div>
            <FeaturedCard note={featuredNote} queue={visibleNotes} />
          </div>
        )}

        {/* feed bar */}
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

          <button
            type="button"
            className={`following-refresh ${loading ? 'is-spinning' : ''}`}
            aria-label="Refresh the feed"
            title="Refresh the feed"
            onClick={retry}
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>

          <span className="following-feed-count micro tabular">
            {loading ? '…' : `${visibleNotes.length} ${visibleNotes.length === 1 ? 'note' : 'notes'}`}
          </span>
        </div>

        {/* ---- states ---- */}
        {error ? (
          <EmptyState
            icon={<Radio />}
            title="Signal interrupted."
            body="Something went wrong while loading your listening room."
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
            creators={shownCreators}
            followingIds={followingIds}
            onToggleFollow={toggleFollow}
          />
        ) : visibleNotes.length === 0 ? (
          <FeedEmpty filter={filter} hasFollowing={shownCreators.length > 0} />
        ) : (
          <div className="following-feed-list">
            {visibleNotes.map((note, i) => (
              <FeedCard
                key={note.id}
                note={note}
                queue={visibleNotes}
                index={i}
                onOpenComments={setCommentsNote}
                album={albumByNote.get(note.id) ?? null}
              />
            ))}
          </div>
        )}

        {/* continue listening */}
        {!loading && !error && recentlyPlayed.length > 0 && (
          <div className="following-continue">
            <div className="following-sec-title">
              <h2 className="following-sec-title__text">
                <Radio size={15} aria-hidden="true" /> Continue listening
              </h2>
            </div>
            <ContinueListening notes={recentlyPlayed} />
          </div>
        )}

        {/* you may like */}
        {!loading && !error && suggestions.length > 0 && (
          <div className="following-maylike">
            <div className="following-sec-title">
              <h2 className="following-sec-title__text">You may like</h2>
              <span className="following-sec-title__meta micro">By popularity</span>
            </div>
            <YouMayLike
              creators={suggestions}
              followingIds={followingIds}
              onToggleFollow={toggleFollow}
            />
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
}: {
  creators: { id: string; handle: string; name: string; avatar: string; bio: string; tint: string; followers: number }[];
  followingIds: Set<string>;
  onToggleFollow: (id: string) => void;
}) {
  return (
    <div className="creator-grid">
      {creators.map((creator, i) => {
        const followed = followingIds.has(creator.id);
        return (
          <article
            key={creator.id}
            className="following-card"
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
          >
            <Link
              to={`/creators/${creator.handle}`}
              className="following-card__open"
              aria-label={`View profile of ${creator.name}`}
            >
              <span
                className="following-card__avatar"
                style={{ ['--tint' as string]: creator.tint }}
              >
                <img src={creator.avatar} alt="" loading="lazy" width={64} height={64} />
              </span>
              <span className="following-card__handle">@{creator.handle}</span>
              <span className="following-card__name">{creator.name}</span>
            </Link>
            <p className="following-card__bio">{creator.bio}</p>
            <div className="following-card__foot">
              <span className="following-card__followers micro tabular">
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

function FeedEmpty({ filter, hasFollowing }: { filter: FeedFilter; hasFollowing: boolean }) {
  if (!hasFollowing) {
    return (
      <EmptyState
        icon={<Compass />}
        title="Your listening room is quiet."
        body="Follow a few voices and their latest stories will appear here."
        action={
          <Link to="/creators" className="btn btn--primary">
            Discover creators <span aria-hidden="true">→</span>
          </Link>
        }
      />
    );
  }
  if (filter === 'new') {
    return (
      <EmptyState
        icon={<Radio />}
        title="Nothing new today."
        body="Nobody from your circle has published in the last 24 hours."
      />
    );
  }
  if (filter === 'albums') {
    return (
      <EmptyState
        icon={<Users />}
        title="No album tracks here."
        body="None of the recent VoiceNotes from your circle belong to a collection."
      />
    );
  }
  return (
    <EmptyState
      icon={<Compass />}
      title="This feed is quiet."
      body="The voices you follow haven't published yet."
    />
  );
}
