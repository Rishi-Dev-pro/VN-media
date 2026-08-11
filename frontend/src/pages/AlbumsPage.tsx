import { Disc3, Lock, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlbumCard } from '../components/albums/AlbumCard';
import { FeaturedAlbum } from '../components/albums/FeaturedAlbum';
import { EmptyState } from '../components/common/EmptyState';
import { useAlbums } from '../hooks/useAlbums';
import type { AlbumSummary } from '../services/albumRepository';
import './AlbumsPage.css';

const delay = (s: string) => ({ animationDelay: s });

type AlbumSort = 'all' | 'newest' | 'listened' | 'tracks';

const SORTS: { id: AlbumSort; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'newest', label: 'Newest' },
  { id: 'listened', label: 'Most listened' },
  { id: 'tracks', label: 'Most VoiceNotes' },
];

export default function AlbumsPage() {
  const { albums, featured, myAlbums, loading, error, retry } = useAlbums();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<AlbumSort>('all');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = albums;
    if (q) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.creatorHandle.toLowerCase().includes(q) ||
          a.creatorName.toLowerCase().includes(q),
      );
    }
    if (sort === 'newest') {
      list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    } else if (sort === 'listened') {
      list = [...list].sort((a, b) => b.plays - a.plays);
    } else if (sort === 'tracks') {
      list = [...list].sort((a, b) => b.trackCount - a.trackCount);
    }
    return list;
  }, [albums, query, sort]);

  const searching = query.trim().length > 0;

  return (
    <div className="albums">
      {/* ---- editorial header ---- */}
      <header className="albums-head">
        <div>
          <p className="albums-head__eyebrow micro land-rise" style={delay('0.05s')}>
            ✦&nbsp; Albums
          </p>
          <h1 className="albums-head__title land-rise" style={delay('0.12s')}>
            VOICES, CURATED
            <br />
            <span className="text-ghost">INTO STORIES.</span>
          </h1>
          <p className="albums-head__sub land-rise" style={delay('0.24s')}>
            Collections of voices, curated into stories — explore what the
            community has put together.
          </p>
        </div>
        <div className="albums-head__count micro land-rise" style={delay('0.3s')} aria-label="Collection count">
          {loading ? '—' : `${albums.length} collections`}
        </div>
      </header>

      {/* ---- featured collection ---- */}
      <section className="albums-featured-sec" aria-label="Featured collection">
        {loading ? (
          <div className="featured-album featured-album--skeleton" aria-hidden="true">
            <div className="featured-album__media">
              <div className="skeleton featured-album__sk-frame" />
            </div>
            <div className="featured-album__body">
              <div className="skeleton albums-sk-line" style={{ width: '38%' }} />
              <div className="skeleton albums-sk-line" style={{ width: '72%', height: 34 }} />
              <div className="skeleton albums-sk-line" style={{ width: '92%' }} />
              <div className="skeleton albums-sk-line" style={{ width: '60%' }} />
            </div>
          </div>
        ) : error ? (
          <div className="albums-error" role="alert">
            <h2>WE LOST THE SIGNAL.</h2>
            <p>Something went wrong while loading collections.</p>
            <button type="button" className="btn btn--ghost" onClick={retry}>
              Try again
            </button>
          </div>
        ) : featured ? (
          <FeaturedAlbum album={featured} />
        ) : (
          <EmptyState
            icon={<Disc3 />}
            title="No collections yet"
            body="Curated albums will appear here as creators publish them."
          />
        )}
      </section>

      {/* ---- explore grid ---- */}
      <section className="albums-grid-sec" aria-label="Explore collections">
        <header className="albums-toolbar">
          <div className="albums-toolbar__head">
            <div>
              <h2 className="section-head__title">Explore collections</h2>
              <p className="section-head__sub">Search titles, creators, and descriptions</p>
            </div>
            <span className="section-head__meta micro">
              {loading ? '—' : `${visible.length} ${visible.length === 1 ? 'album' : 'albums'}`}
            </span>
          </div>

          <div className="albums-toolbar__row">
            <div className="albums-search" role="search">
              <Search size={16} aria-hidden="true" className="albums-search__icon" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search albums…"
                aria-label="Search albums"
                maxLength={80}
              />
              {query && (
                <button
                  type="button"
                  className="albums-search__clear"
                  aria-label="Clear album search"
                  onClick={() => setQuery('')}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="albums-sorts no-scrollbar" role="group" aria-label="Sort albums">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`albums-sorts__btn ${sort === s.id ? 'is-active' : ''}`}
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
          <div className="albums-grid" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="album-card-v2 album-card-v2--skeleton">
                <div className="skeleton album-card-v2__sk-art" />
                <div className="skeleton albums-sk-line" style={{ width: '70%' }} />
                <div className="skeleton albums-sk-line" style={{ width: '44%' }} />
              </div>
            ))}
          </div>
        ) : error ? null : searching && visible.length === 0 ? (
          <div className="albums-nothing">
            <p className="albums-nothing__title">NO COLLECTIONS FOUND.</p>
            <p className="albums-nothing__sub">Try another title, creator, or phrase.</p>
            <button type="button" className="btn btn--ghost" onClick={() => setQuery('')}>
              Reset search
            </button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Disc3 />}
            title="Nothing here yet"
            body="Albums will show up here once creators start collecting their voices."
          />
        ) : (
          <div className="albums-grid">
            {visible.map((album, i) => (
              <AlbumCard key={album.id} album={album} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* ---- my albums (private, demo listener only) ---- */}
      {!loading && !error && myAlbums.length > 0 && (
        <MyAlbums albums={myAlbums} />
      )}
    </div>
  );
}

/** The demo listener's own private collections — never public discovery. */
function MyAlbums({ albums }: { albums: AlbumSummary[] }) {
  return (
    <section className="albums-mine" aria-label="My albums">
      <header className="albums-toolbar__head">
        <div>
          <h2 className="section-head__title">My albums</h2>
          <p className="section-head__sub">Private collections — only you can see these</p>
        </div>
      </header>
      <div className="albums-mine__list">
        {albums.map((album, i) => (
          <Link
            key={album.id}
            to={`/albums/${album.id}`}
            className="albums-mine__item"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="albums-mine__art">
              <img src={album.cover} alt="" loading="lazy" width={96} height={96} />
              <span className="albums-mine__lock" aria-hidden="true">
                <Lock size={11} />
              </span>
            </span>
            <span className="albums-mine__meta">
              <span className="albums-mine__title">{album.title}</span>
              <span className="albums-mine__sub micro">
                Private · {album.trackCount} tracks · {album.year}
              </span>
            </span>
            <span className="albums-mine__go" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
