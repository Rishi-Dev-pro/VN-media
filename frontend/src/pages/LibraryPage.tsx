import {
  Bookmark,
  Clock3,
  Disc3,
  Heart,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlbumCard } from '../components/albums/AlbumCard';
import { CommentsDrawer } from '../components/comments/CommentsDrawer';
import { EmptyState } from '../components/common/EmptyState';
import { Equalizer } from '../components/common/Equalizer';
import { LikeButton } from '../components/common/LikeButton';
import { MoreMenu } from '../components/common/MoreMenu';
import { ContinueCard } from '../components/library/ContinueCard';
import { FeedCard } from '../components/voiceNotes/FeedCard';
import { getCreatorSafe as getCreator, getListener } from '../services/api/identity';
import { DEMO_NOW } from '../data/mockFollowing';
import type { VoiceNote } from '../data/types';
import {
  searchAlbums,
  searchNotes,
  sortAlbums,
  sortNotes,
  useLibrary,
  type AlbumSort,
  type NoteSort,
} from '../hooks/useLibrary';
import type { AlbumSummary } from '../services/albumRepository';
import type { RecentEntry } from '../services/libraryRepository';
import { useEngagement } from '../hooks/useEngagement';
import { usePlayer } from '../state/PlayerContext';
import { formatRelative, formatTime } from '../utils/format';
import './LibraryPage.css';

type Tab = 'all' | 'saved' | 'liked' | 'albums' | 'recent';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'saved', label: 'Saved' },
  { id: 'liked', label: 'Liked' },
  { id: 'albums', label: 'Albums' },
  { id: 'recent', label: 'Recently played' },
];

const NOTE_SORTS: { id: NoteSort; label: string }[] = [
  { id: 'recentlyAdded', label: 'Recently added' },
  { id: 'recentlyPlayed', label: 'Recently played' },
  { id: 'mostLiked', label: 'Most liked' },
  { id: 'az', label: 'A → Z' },
];

const ALBUM_SORTS: { id: AlbumSort; label: string }[] = [
  { id: 'recentlySaved', label: 'Recently saved' },
  { id: 'released', label: 'Recently released' },
  { id: 'plays', label: 'Most played' },
  { id: 'az', label: 'A → Z' },
];

export default function LibraryPage() {
  const { loading, error, retry, savedNotes, savedAlbums, recents, likedNotes, stats, removeSavedNote, removeSavedAlbum, recordPlay, clearHistory } = useLibrary();

  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: Tab = TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : 'all';

  const [query, setQuery] = useState('');
  const [commentsNote, setCommentsNote] = useState<VoiceNote | null>(null);
  const [noteSort, setNoteSort] = useState<NoteSort>('recentlyAdded');
  const [albumSort, setAlbumSort] = useState<AlbumSort>('recentlySaved');
  const [toast, setToast] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const setTab = useCallback(
    (next: Tab) => {
      setParams(next === 'all' ? {} : { tab: next }, { replace: true });
    },
    [setParams],
  );

  /* ---- toast ---- */
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const handleRemoveNote = useCallback(
    (note: VoiceNote) => {
      removeSavedNote(note.id);
      showToast('REMOVED FROM LIBRARY');
    },
    [removeSavedNote, showToast],
  );

  const handleRemoveAlbum = useCallback(
    (album: AlbumSummary) => {
      removeSavedAlbum(album.id);
      showToast('REMOVED FROM LIBRARY');
    },
    [removeSavedAlbum, showToast],
  );

  const handleClear = useCallback(() => {
    clearHistory();
    setConfirmClear(false);
    showToast('HISTORY CLEARED');
  }, [clearHistory, showToast]);

  /* ---- filtered + sorted lists ---- */
  const filteredSaved = useMemo(
    () => sortNotes(searchNotes(savedNotes, query), noteSort, recents),
    [savedNotes, query, noteSort, recents],
  );
  const filteredLiked = useMemo(
    () => sortNotes(searchNotes(likedNotes, query), noteSort, recents),
    [likedNotes, query, noteSort, recents],
  );
  const filteredAlbums = useMemo(
    () => sortAlbums(searchAlbums(savedAlbums, query), albumSort),
    [savedAlbums, query, albumSort],
  );
  const filteredRecents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recents;
    return recents.filter((r) => {
      const n = r.note;
      const creator = getCreator(n.creatorId);
      return (
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)) ||
        creator.handle.toLowerCase().includes(q)
      );
    });
  }, [recents, query]);

  const searching = query.trim().length > 0;
  const noMatches = searching && tab !== 'all' && (tab === 'albums' ? filteredAlbums.length === 0 : (tab === 'recent' ? filteredRecents.length === 0 : (tab === 'liked' ? filteredLiked.length === 0 : filteredSaved.length === 0)));
  const allTabEmpty =
    tab === 'all' &&
    savedNotes.length === 0 &&
    savedAlbums.length === 0 &&
    recents.length === 0 &&
    !searching;

  const savedQueue = useMemo(() => filteredSaved, [filteredSaved]);
  const likedQueue = useMemo(() => filteredLiked, [filteredLiked]);
  const recentQueue = useMemo(() => filteredRecents.map((r) => r.note), [filteredRecents]);

  return (
    <div className="library">
      {/* ---------- header ---------- */}
      <header className="library-head">
        <div>
          <span className="library-head__eyebrow micro">Personal library</span>
          <h1 className="library-head__title">
            YOUR LISTENING
            <br />
            <span className="text-ghost">LIBRARY.</span>
          </h1>
          <p className="library-head__sub">Everything you wanted to hear again.</p>
        </div>
        <span className="library-head__room">
          <span className="library-head__room-dot" aria-hidden="true" />
          LISTENING ROOM · @{getListener().handle}
        </span>
      </header>

      {/* ---------- stats ---------- */}
      {!loading && !error && (
        <section className="library-stats" aria-label="Library overview">
          <StatTile icon={<Bookmark size={15} />} value={stats.saved} label="Saved VoiceNotes" />
          <StatTile icon={<Disc3 size={15} />} value={stats.albums} label="Albums" />
          <StatTile icon={<Heart size={15} />} value={stats.liked} label="Liked" />
          <StatTile icon={<Clock3 size={15} />} value={stats.recent} label="Recently played" />
        </section>
      )}

      {/* ---------- controls ---------- */}
      <div className="library-controls">
        <div className="lib-tabs" role="tablist" aria-label="Library sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`lib-tabs__item ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="library-search">
          <Search size={15} aria-hidden="true" className="library-search__icon" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library..."
            aria-label="Search your library"
            className="library-search__input"
          />
          {searching && (
            <button
              type="button"
              className="library-search__clear"
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ---------- loading ---------- */}
      {loading && <LibrarySkeleton />}

      {/* ---------- error ---------- */}
      {!loading && error && (
        <EmptyState
          icon={<span className="library-empty__orb" aria-hidden="true">✕</span>}
          title="YOUR LIBRARY LOST THE SIGNAL."
          body="Something interrupted the connection to your listening room."
          action={
            <button type="button" className="btn btn--primary" onClick={retry}>
              TRY AGAIN
            </button>
          }
        />
      )}

      {/* ---------- content ---------- */}
      {!loading && !error && tab === 'all' && (
        <div className="library-all">
          {recents.length > 0 && (
            <section className="library-section">
              <div className="section-head">
                <div>
                  <h2 className="section-head__title">Continue listening</h2>
                  <p className="section-head__sub">Pick up where you left off.</p>
                </div>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setTab('recent')}
                >
                  View all
                </button>
              </div>
              <div className="continue-strip">
                {filteredRecents.slice(0, 4).map((entry) => (
                  <ContinueCard
                    key={entry.note.id}
                    entry={entry}
                    queue={recentQueue}
                    onPlay={(n) => recordPlay(n.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredSaved.length > 0 && (
            <section className="library-section">
              <div className="section-head">
                <div>
                  <h2 className="section-head__title">Your saved voices</h2>
                  <p className="section-head__sub">Kept close for another listen.</p>
                </div>
              </div>
              <div className="library-notes-grid">
                {filteredSaved.map((note, i) => (
                  <FeedCard
                    key={note.id}
                    note={note}
                    queue={savedQueue}
                    index={i}
                    onPlay={(n) => recordPlay(n.id)}
                    onRemove={handleRemoveNote}
                    onOpenComments={setCommentsNote}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredAlbums.length > 0 && (
            <section className="library-section">
              <div className="section-head">
                <div>
                  <h2 className="section-head__title">Saved collections</h2>
                  <p className="section-head__sub">Albums worth returning to.</p>
                </div>
                <button type="button" className="text-link" onClick={() => setTab('albums')}>
                  View all
                </button>
              </div>
              <div className="library-album-grid">
                {filteredAlbums.slice(0, 4).map((album, i) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    index={i}
                    onRemove={handleRemoveAlbum}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredRecents.length > 0 && (
            <section className="library-section">
              <div className="section-head">
                <div>
                  <h2 className="section-head__title">Recently played</h2>
                  <p className="section-head__sub">Your last few listens.</p>
                </div>
                <button type="button" className="text-link" onClick={() => setTab('recent')}>
                  View all
                </button>
              </div>
              <ul className="library-recent-list">
                {filteredRecents.slice(0, 5).map((entry) => (
                  <RecentRow
                    key={entry.note.id}
                    entry={entry}
                    queue={recentQueue}
                    onPlay={(n) => recordPlay(n.id)}
                  />
                ))}
              </ul>
            </section>
          )}

          {allTabEmpty && (
            <EmptyState
              icon={<Bookmark size={26} />}
              title="YOUR LISTENING ROOM IS EMPTY."
              body="Save a VoiceNote or an album from Discover and it will appear here."
              action={
                <Link to="/discover" className="btn btn--primary">
                  EXPLORE DISCOVER
                </Link>
              }
            />
          )}

          {searching && filteredSaved.length === 0 && filteredAlbums.length === 0 && filteredRecents.length === 0 && (
            <SearchEmpty onReset={() => setQuery('')} />
          )}
        </div>
      )}

      {/* ---------- saved ---------- */}
      {!loading && !error && tab === 'saved' && (
        <section className="library-section">
          <div className="section-head">
            <div>
              <h2 className="section-head__title">Saved VoiceNotes</h2>
              <p className="section-head__sub">Voices you kept close.</p>
            </div>
            <SortMenu
              label="Sort"
              options={NOTE_SORTS}
              value={noteSort}
              onChange={setNoteSort}
            />
          </div>
          {filteredSaved.length > 0 ? (
            <>
              {searching && (
                <p className="library-result-count">
                  {filteredSaved.length} {filteredSaved.length === 1 ? 'result' : 'results'}
                </p>
              )}
              <div className="library-notes-grid">
                {filteredSaved.map((note, i) => (
                  <FeedCard
                    key={note.id}
                    note={note}
                    queue={savedQueue}
                    index={i}
                    onPlay={(n) => recordPlay(n.id)}
                    onRemove={handleRemoveNote}
                    onOpenComments={setCommentsNote}
                  />
                ))}
              </div>
            </>
          ) : noMatches ? (
            <SearchEmpty onReset={() => setQuery('')} />
          ) : (
            <EmptyState
              icon={<Bookmark size={26} />}
              title="YOUR SAVED VOICES ARE WAITING."
              body="Save something from Discover and it'll appear here."
              action={
                <Link to="/discover" className="btn btn--primary">
                  EXPLORE DISCOVER
                </Link>
              }
            />
          )}
        </section>
      )}

      {/* ---------- liked ---------- */}
      {!loading && !error && tab === 'liked' && (
        <section className="library-section">
          <div className="section-head">
            <div>
              <h2 className="section-head__title">Liked VoiceNotes</h2>
              <p className="section-head__sub">The ones that got your heart.</p>
            </div>
            <SortMenu
              label="Sort"
              options={NOTE_SORTS}
              value={noteSort}
              onChange={setNoteSort}
            />
          </div>
          {filteredLiked.length > 0 ? (
            <>
              {searching && (
                <p className="library-result-count">
                  {filteredLiked.length} {filteredLiked.length === 1 ? 'result' : 'results'}
                </p>
              )}
              <div className="library-notes-grid">
                {filteredLiked.map((note, i) => (
                  <FeedCard
                    key={note.id}
                    note={note}
                    queue={likedQueue}
                    index={i}
                    onPlay={(n) => recordPlay(n.id)}
                    onOpenComments={setCommentsNote}
                  />
                ))}
              </div>
            </>
          ) : noMatches ? (
            <SearchEmpty onReset={() => setQuery('')} />
          ) : (
            <EmptyState
              icon={<Heart size={26} />}
              title="NOTHING YOU LOVE YET."
              body="Tap the heart on a VoiceNote to keep it close."
              action={
                <Link to="/discover" className="btn btn--primary">
                  EXPLORE DISCOVER
                </Link>
              }
            />
          )}
        </section>
      )}

      {/* ---------- albums ---------- */}
      {!loading && !error && tab === 'albums' && (
        <section className="library-section">
          <div className="section-head">
            <div>
              <h2 className="section-head__title">Saved collections</h2>
              <p className="section-head__sub">Albums in your library.</p>
            </div>
            <SortMenu
              label="Sort"
              options={ALBUM_SORTS}
              value={albumSort}
              onChange={setAlbumSort}
            />
          </div>
          {filteredAlbums.length > 0 ? (
            <>
              {searching && (
                <p className="library-result-count">
                  {filteredAlbums.length} {filteredAlbums.length === 1 ? 'result' : 'results'}
                </p>
              )}
              <div className="library-album-grid">
                {filteredAlbums.map((album, i) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    index={i}
                    onRemove={handleRemoveAlbum}
                  />
                ))}
              </div>
            </>
          ) : noMatches ? (
            <SearchEmpty onReset={() => setQuery('')} />
          ) : (
            <EmptyState
              icon={<Disc3 size={26} />}
              title="NO COLLECTIONS SAVED."
              body="Find an album worth returning to."
              action={
                <Link to="/albums" className="btn btn--primary">
                  EXPLORE ALBUMS
                </Link>
              }
            />
          )}
        </section>
      )}

      {/* ---------- recently played ---------- */}
      {!loading && !error && tab === 'recent' && (
        <section className="library-section">
          <div className="section-head">
            <div>
              <h2 className="section-head__title">Recently played</h2>
              <p className="section-head__sub">Your listening history.</p>
            </div>
            {filteredRecents.length > 0 && (
              <button
                type="button"
                className="library-clear"
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 size={14} aria-hidden="true" />
                Clear history
              </button>
            )}
          </div>
          {filteredRecents.length > 0 ? (
            <>
              {searching && (
                <p className="library-result-count">
                  {filteredRecents.length} {filteredRecents.length === 1 ? 'result' : 'results'}
                </p>
              )}
              <ul className="library-recent-list">
                {filteredRecents.map((entry) => (
                  <RecentRow
                    key={entry.note.id}
                    entry={entry}
                    queue={recentQueue}
                    onPlay={(n) => recordPlay(n.id)}
                  />
                ))}
              </ul>
            </>
          ) : noMatches ? (
            <SearchEmpty onReset={() => setQuery('')} />
          ) : (
            <EmptyState
              icon={<Clock3 size={26} />}
              title="NOTHING PLAYED YET."
              body="Your next favorite voice is waiting."
              action={
                <Link to="/discover" className="btn btn--primary">
                  DISCOVER
                </Link>
              }
            />
          )}
        </section>
      )}

      {/* ---------- toast ---------- */}
      {toast && (
        <div className="library-toast" role="status" aria-live="polite">
          <span className="library-toast__dot" aria-hidden="true" />
          {toast}
        </div>
      )}

      {/* ---------- clear history confirm ---------- */}
      {confirmClear && (
        <ClearConfirm
          onCancel={() => setConfirmClear(false)}
          onConfirm={handleClear}
        />
      )}

      <CommentsDrawer note={commentsNote} onClose={() => setCommentsNote(null)} />
    </div>
  );
}

/* ============================================================
   Small presentational pieces
   ============================================================ */

function StatTile({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="library-stat">
      <span className="library-stat__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="library-stat__value tabular">{value}</span>
      <span className="library-stat__label">{label}</span>
    </div>
  );
}

interface SortMenuProps<T extends string> {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}

function SortMenu<T extends string>({ label, options, value, onChange }: SortMenuProps<T>) {
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

  const active = options.find((o) => o.id === value);

  return (
    <div ref={rootRef} className="lib-sort">
      <button
        type="button"
        className="lib-sort__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label}: <span className="lib-sort__value">{active?.label}</span>
      </button>
      {open && (
        <div className="lib-sort__pop" role="menu" aria-label={`${label} options`}>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={o.id === value}
              className={`lib-sort__item ${o.id === value ? 'is-active' : ''}`}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface RecentRowProps {
  entry: RecentEntry;
  queue: VoiceNote[];
  onPlay?: (note: VoiceNote) => void;
}

function RecentRow({ entry, queue, onPlay }: RecentRowProps) {
  const { note, playedAt, progress } = entry;
  const { current, isPlaying, elapsed, play, toggle } = usePlayer();
  const { liked, busy: likeBusy, toggle: toggleLike } = useEngagement(note);
  const creator = getCreator(note.creatorId);

  const isCurrent = current?.id === note.id;
  const playing = isCurrent && isPlaying;
  const pct = isCurrent && note.duration > 0 ? Math.min(elapsed / note.duration, 1) : progress;

  const activate = useCallback(() => {
    if (isCurrent) toggle();
    else {
      play(note, queue);
      onPlay?.(note);
    }
  }, [isCurrent, note, queue, play, toggle, onPlay]);

  return (
    <li>
      <div
        className={`recent-row ${playing ? 'is-playing' : ''}`}
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        }}
        aria-label={`${note.title} by ${creator.name} — ${playing ? 'pause' : 'play'}`}
      >
        <span className="recent-row__art">
          <img src={note.cover} alt="" loading="lazy" width={46} height={46} />
          <span className="recent-row__play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M8 5.5v13l11-6.5-11-6.5z" />
            </svg>
          </span>
          <Equalizer playing={playing} bars={3} className="recent-row__eq" />
        </span>

        <span className="recent-row__meta">
          <span className="recent-row__title">{note.title}</span>
          <span className="recent-row__sub">
            @{creator.handle}
            <span className="recent-row__when tabular">· {formatRelative(new Date(playedAt).toISOString(), DEMO_NOW)}</span>
          </span>
          <span className="recent-row__bar" aria-hidden="true">
            <span className="recent-row__fill" style={{ width: `${Math.round(pct * 100)}%` }} />
          </span>
        </span>

        <span className="recent-row__duration tabular">{formatTime(note.duration)}</span>

        <LikeButton
          liked={liked}
          iconOnly
          busy={likeBusy}
          onClick={(e) => {
            e.stopPropagation();
            void toggleLike();
          }}
          label={note.title}
        />

        <span onClick={(e) => e.stopPropagation()} role="presentation">
          <MoreMenu itemLabel={note.title} note={note} />
        </span>
      </div>
    </li>
  );
}

function SearchEmpty({ onReset }: { onReset: () => void }) {
  return (
    <EmptyState
      icon={<Search size={26} />}
      title="NOTHING IN YOUR LIBRARY."
      body="Try another title, creator or tag."
      action={
        <button type="button" className="btn btn--primary" onClick={onReset}>
          CLEAR SEARCH
        </button>
      }
    />
  );
}

interface ClearConfirmProps {
  onCancel: () => void;
  onConfirm: () => void;
}

function ClearConfirm({ onCancel, onConfirm }: ClearConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="library-dialog-backdrop"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="library-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-dialog-title"
      >
        <h2 id="clear-dialog-title" className="library-dialog__title">
          CLEAR RECENTLY PLAYED?
        </h2>
        <p className="library-dialog__body">
          This will remove your listening history from this device.
        </p>
        <div className="library-dialog__actions">
          <button type="button" className="btn btn--ghost" ref={cancelRef} onClick={onCancel}>
            CANCEL
          </button>
          <button type="button" className="btn btn--ghost library-btn-danger" onClick={onConfirm}>
            CLEAR HISTORY
          </button>
        </div>
      </div>
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div aria-hidden="true" className="library-skeleton">
      <div className="library-sk-stats">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton library-sk-stat" />
        ))}
      </div>
      <div className="library-sk-strip">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton library-sk-card" />
        ))}
      </div>
      <div className="library-sk-grid">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="skeleton library-sk-note" />
        ))}
      </div>
    </div>
  );
}

