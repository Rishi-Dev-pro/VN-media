import { Disc3 } from 'lucide-react';
import { AlbumCard } from '../components/albums/AlbumCard';
import { FeaturedAlbum } from '../components/albums/FeaturedAlbum';
import { EmptyState } from '../components/common/EmptyState';
import { useAlbums } from '../hooks/useAlbums';
import './AlbumsPage.css';

const delay = (s: string) => ({ animationDelay: s });

export default function AlbumsPage() {
  const { albums, featured, loading, error, retry } = useAlbums();

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
        <header className="section-head">
          <div>
            <h2 className="section-head__title">Explore collections</h2>
            <p className="section-head__sub">Newest and most loved first</p>
          </div>
          <span className="section-head__meta micro">
            {loading ? '—' : `${albums.length} albums`}
          </span>
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
        ) : error ? null : albums.length === 0 ? (
          <EmptyState
            icon={<Disc3 />}
            title="Nothing here yet"
            body="Albums will show up here once creators start collecting their voices."
          />
        ) : (
          <div className="albums-grid">
            {albums.map((album, i) => (
              <AlbumCard key={album.id} album={album} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
