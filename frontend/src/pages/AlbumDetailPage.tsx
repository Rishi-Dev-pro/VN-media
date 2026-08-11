import { ArrowLeft, Bookmark, Disc3, Play, UserPlus, UserCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlbumCard } from '../components/albums/AlbumCard';
import { Avatar } from '../components/common/Avatar';
import { MoreMenu } from '../components/common/MoreMenu';
import { TrackRow } from '../components/voiceNotes/TrackRow';
import { useAlbum } from '../hooks/useAlbums';
import { createAlbumRepository, type AlbumSummary } from '../services/albumRepository';
import { useFollows } from '../state/FollowContext';
import { usePlayer } from '../state/PlayerContext';
import { formatCount, formatMinutes } from '../utils/format';
import './AlbumDetailPage.css';

const delay = (s: string) => ({ animationDelay: s });

export default function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { album, loading, error, retry } = useAlbum(id);
  const { play } = usePlayer();
  const { isFollowing, toggleFollow } = useFollows();
  const [saved, setSaved] = useState(false);

  const playAll = useCallback(() => {
    if (album && album.tracks.length > 0) play(album.tracks[0], album.tracks);
  }, [album, play]);

  const toggleSaved = useCallback(() => setSaved((s) => !s), []);

  if (loading) {
    return (
      <div className="album-detail" aria-busy="true">
        <Link to="/albums" className="album-detail__back micro">
          <ArrowLeft size={14} aria-hidden="true" /> Albums
        </Link>
        <div className="album-detail__layout">
          <div className="album-detail__media">
            <div className="skeleton album-detail__sk-art" />
          </div>
          <div className="album-detail__info">
            <div className="skeleton album-detail__sk-line" style={{ width: '36%' }} />
            <div className="skeleton album-detail__sk-line" style={{ width: '78%', height: 40 }} />
            <div className="skeleton album-detail__sk-line" style={{ width: '94%' }} />
            <div className="skeleton album-detail__sk-line" style={{ width: '64%' }} />
            <div className="skeleton album-detail__sk-line" style={{ width: '46%' }} />
          </div>
        </div>
        <div className="skeleton album-detail__sk-list" aria-hidden="true" />
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="album-detail">
        <Link to="/albums" className="album-detail__back micro">
          <ArrowLeft size={14} aria-hidden="true" /> Albums
        </Link>
        <div className="albums-error" role="alert">
          <h2>{error ? 'WE LOST THE SIGNAL.' : 'ALBUM NOT FOUND.'}</h2>
          <p>
            {error
              ? 'Something went wrong while loading this collection.'
              : 'This collection may have been unpublished or never existed.'}
          </p>
          {error ? (
            <button type="button" className="btn btn--ghost" onClick={retry}>
              Try again
            </button>
          ) : (
            <Link to="/albums" className="btn btn--ghost">
              Browse albums
            </Link>
          )}
        </div>
      </div>
    );
  }

  const following = isFollowing(album.creatorId);

  return (
    <div className="album-detail">
      <Link to="/albums" className="album-detail__back micro land-rise">
        <ArrowLeft size={14} aria-hidden="true" /> Albums
      </Link>

      <div className="album-detail__layout">
        {/* ---- media ---- */}
        <div className="album-detail__media land-rise" style={delay('0.08s')}>
          <div className="album-detail__frame">
            <img src={album.cover} alt={`Artwork for ${album.title}`} width={560} height={700} />
            <span className="album-detail__notch" aria-hidden="true" />
            <span className="album-detail__scrim" aria-hidden="true" />
            <span className="album-detail__chip micro">
              <Disc3 size={11} aria-hidden="true" />
              {album.trackCount} tracks
            </span>
          </div>
        </div>

        {/* ---- info ---- */}
        <div className="album-detail__info">
          <p className="album-detail__kicker micro">
            ✦&nbsp; Collection · {album.year} · <span className="album-detail__vis">Public</span>
          </p>
          <h1 className="album-detail__title">{album.title}</h1>
          <p className="album-detail__desc">{album.description}</p>

          <div className="album-detail__creator">
            <Avatar src={album.creatorAvatar} alt={album.creatorName} size={42} />
            <span className="album-detail__creator-meta">
              <span className="album-detail__creator-name">{album.creatorName}</span>
              <span className="album-detail__creator-handle">@{album.creatorHandle}</span>
            </span>
            <button
              type="button"
              className={`album-detail__follow ${following ? 'is-following' : ''}`}
              aria-pressed={following}
              onClick={() => toggleFollow(album.creatorId)}
            >
              {following ? (
                <>
                  <UserCheck size={13} aria-hidden="true" /> Following
                </>
              ) : (
                <>
                  <UserPlus size={13} aria-hidden="true" /> Follow
                </>
              )}
            </button>
          </div>

          <dl className="album-detail__stats">
            <div>
              <dt>VoiceNotes</dt>
              <dd className="tabular">{album.trackCount}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd className="tabular">{formatMinutes(album.totalDuration)}</dd>
            </div>
            <div>
              <dt>Plays</dt>
              <dd className="tabular">{formatCount(album.plays)}</dd>
            </div>
            <div>
              <dt>Likes</dt>
              <dd className="tabular">{formatCount(album.likes)}</dd>
            </div>
          </dl>

          <div className="album-detail__actions">
            <button type="button" className="btn btn--primary album-detail__play" onClick={playAll}>
              <Play size={15} fill="currentColor" aria-hidden="true" />
              Play collection
            </button>
            <button
              type="button"
              className={`btn btn--ghost album-detail__save ${saved ? 'is-saved' : ''}`}
              aria-pressed={saved}
              onClick={toggleSaved}
            >
              <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
              {saved ? 'Saved' : 'Save'}
            </button>
            <span className="album-detail__more" onClick={(e) => e.stopPropagation()}>
              <MoreMenu itemLabel={album.title} align="right" />
            </span>
          </div>
        </div>
      </div>

      {/* ---- track list ---- */}
      <section className="album-detail__tracks" aria-label="Tracks">
        <header className="section-head">
          <div>
            <h2 className="section-head__title">Tracks</h2>
            <p className="section-head__sub">
              {album.trackCount} VoiceNotes · {formatMinutes(album.totalDuration)} in total
            </p>
          </div>
          <span className="section-head__meta micro">
            {formatCount(album.comments)} comments across the collection
          </span>
        </header>
        <ul className="album-detail__list">
          {album.tracks.map((note) => (
            <TrackRow key={note.id} note={note} queue={album.tracks} />
          ))}
        </ul>
      </section>

      {/* ---- related ---- */}
      <RelatedAlbums albumId={album.id} />
    </div>
  );
}

function RelatedAlbums({ albumId }: { albumId: string }) {
  const { albums, loading } = useRelated(albumId);
  if (loading || albums.length === 0) return null;
  return (
    <section className="album-detail__related" aria-label="More collections">
      <header className="section-head">
        <div>
          <h2 className="section-head__title">More collections</h2>
          <p className="section-head__sub">From the same hands and nearby voices</p>
        </div>
      </header>
      <div className="albums-grid">
        {albums.map((album, i) => (
          <AlbumCard key={album.id} album={album} index={i} />
        ))}
      </div>
    </section>
  );
}

/** Small local hook — related albums for the detail page. */
function useRelated(albumId: string): { albums: AlbumSummary[]; loading: boolean } {
  const [related, setRelated] = useState<AlbumSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const repo = createAlbumRepository();
    void repo.getRelated(albumId).then((list) => {
      if (!active) return;
      setRelated(list);
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId]);

  return useMemo(() => ({ albums: related, loading }), [related, loading]);
}
