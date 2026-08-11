import { ArrowLeft, Calendar, Check, Disc3, MessageCircle, Mic2, Plus, Radio } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlbumCard } from '../components/albums/AlbumCard';
import { EmptyState } from '../components/common/EmptyState';
import { FeedCard } from '../components/voiceNotes/FeedCard';
import { notesByCreator } from '../data/mockFollowing';
import { useCreator } from '../hooks/useCreators';
import { createAlbumRepository, type AlbumSummary } from '../services/albumRepository';
import { useFollows } from '../state/FollowContext';
import { formatCount, formatReleaseDate } from '../utils/format';
import './CreatorProfilePage.css';

type ProfileTab = 'notes' | 'albums' | 'about';

export default function CreatorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { creator, loading, error, retry } = useCreator(username);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isFollowing, toggleFollow } = useFollows();

  const tab = (searchParams.get('tab') as ProfileTab) ?? 'notes';
  const setTab = useCallback(
    (t: ProfileTab) => setSearchParams(t === 'notes' ? {} : { tab: t }, { replace: true }),
    [setSearchParams],
  );

  const [messageNote, setMessageNote] = useState(false);

  const notes = useMemo(
    () => (creator ? notesByCreator(creator.id) : []),
    [creator],
  );

  if (loading) {
    return (
      <div className="creator-profile" aria-busy="true">
        <Link to="/creators" className="creator-profile__back micro">
          <ArrowLeft size={14} aria-hidden="true" /> Creators
        </Link>
        <div className="creator-profile__hero creator-profile__hero--skeleton">
          <div className="skeleton creator-profile__sk-art" />
          <div className="creator-profile__hero-body">
            <div className="skeleton creators-line" style={{ width: '34%' }} />
            <div className="skeleton creators-line" style={{ width: '58%', height: 34 }} />
            <div className="skeleton creators-line" style={{ width: '88%' }} />
            <div className="skeleton creators-line" style={{ width: '70%' }} />
          </div>
        </div>
        <div className="skeleton creator-profile__sk-tabs" aria-hidden="true" />
        <div className="creator-profile__list" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton creator-profile__sk-row" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="creator-profile">
        <Link to="/creators" className="creator-profile__back micro">
          <ArrowLeft size={14} aria-hidden="true" /> Creators
        </Link>
        <div className="creators-error" role="alert">
          <h2>{error ? 'SOMETHING INTERRUPTED THE SIGNAL.' : 'CREATOR NOT FOUND.'}</h2>
          <p>
            {error
              ? 'We couldn’t load this profile. Try again.'
              : 'This voice doesn’t exist here.'}
          </p>
          {error ? (
            <button type="button" className="btn btn--ghost" onClick={retry}>
              Try again
            </button>
          ) : (
            <Link to="/creators" className="btn btn--ghost">
              Back to creators
            </Link>
          )}
        </div>
      </div>
    );
  }

  const followed = isFollowing(creator.id);
  const followers = creator.followers + (followed ? 1 : 0);

  return (
    <div className="creator-profile">
      {/* restrained blurred backdrop */}
      <div className="creator-profile__backdrop" aria-hidden="true">
        <img src={creator.heroImage ?? creator.avatar} alt="" />
      </div>

      <Link to="/creators" className="creator-profile__back micro land-rise">
        <ArrowLeft size={14} aria-hidden="true" /> Creators
      </Link>

      {/* ---- hero ---- */}
      <section className="creator-profile__hero">
        <div className="creator-profile__media land-rise" style={{ animationDelay: '0.08s' }}>
          <div className="creator-profile__frame">
            <img
              src={creator.heroImage ?? creator.avatar}
              alt={`Portrait of ${creator.name}`}
              width={560}
              height={700}
            />
            <span className="creator-profile__notch" aria-hidden="true" />
            <span className="creator-profile__scrim" aria-hidden="true" />
            <span className="creator-profile__chip micro">
              <Radio size={10} aria-hidden="true" />
              Creator
            </span>
          </div>
        </div>

        <div className="creator-profile__info">
          <p className="creator-profile__kicker micro">
            ✦&nbsp; {creator.featured ? 'Featured creator' : 'Voice on VN-Media'}
          </p>
          <h1 className="creator-profile__name">{creator.name}</h1>
          <p className="creator-profile__handle">@{creator.handle}</p>
          <p className="creator-profile__bio">{creator.bio}</p>

          <dl className="creator-profile__stats">
            <div>
              <dt>Followers</dt>
              <dd className="tabular">{formatCount(followers)}</dd>
            </div>
            <div>
              <dt>Following</dt>
              <dd className="tabular">{formatCount(creator.following)}</dd>
            </div>
            <div>
              <dt>VoiceNotes</dt>
              <dd className="tabular">{creator.voiceNoteCount}</dd>
            </div>
            <div>
              <dt>Albums</dt>
              <dd className="tabular">{creator.albumCount}</dd>
            </div>
          </dl>

          <div className="creator-profile__actions">
            <button
              type="button"
              className={`btn btn--primary creator-profile__follow ${followed ? 'is-following' : ''}`}
              aria-pressed={followed}
              onClick={() => toggleFollow(creator.id)}
            >
              {followed ? (
                <>
                  <Check size={15} aria-hidden="true" /> Following
                </>
              ) : (
                <>
                  <Plus size={15} aria-hidden="true" /> Follow
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn--ghost creator-profile__message"
              aria-haspopup="dialog"
              aria-expanded={messageNote}
              onClick={() => setMessageNote((v) => !v)}
            >
              <MessageCircle size={15} aria-hidden="true" /> Message
            </button>
          </div>

          {messageNote && (
            <p className="creator-profile__message-note micro" role="status">
              Messaging arrives in a future phase — no messages were sent.
            </p>
          )}

          <p className="creator-profile__joined micro">
            <Calendar size={11} aria-hidden="true" /> Joined {formatReleaseDate(creator.joinedAt)}
          </p>
        </div>
      </section>

      {/* ---- tabs ---- */}
      <nav className="creator-profile__tabs" aria-label="Profile sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notes'}
          className={tab === 'notes' ? 'is-active' : ''}
          onClick={() => setTab('notes')}
        >
          VoiceNotes <span className="tabular">{creator.voiceNoteCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'albums'}
          className={tab === 'albums' ? 'is-active' : ''}
          onClick={() => setTab('albums')}
        >
          Albums <span className="tabular">{creator.albumCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'about'}
          className={tab === 'about' ? 'is-active' : ''}
          onClick={() => setTab('about')}
        >
          About
        </button>
      </nav>

      {/* ---- content ---- */}
      {tab === 'notes' && (
        <section className="creator-profile__tab" aria-label="VoiceNotes">
          {creator.voiceNoteCount > 0 && (
            <p className="creator-profile__activity micro">
              <Radio size={11} aria-hidden="true" /> Recently published — newest first
            </p>
          )}
          {notes.length === 0 ? (
            <EmptyState
              icon={<Mic2 />}
              title="NO VOICE NOTES YET."
              body="This creator hasn’t published any VoiceNotes yet."
            />
          ) : (
            <div className="creator-profile__list">
              {notes.map((note, i) => (
                <FeedCard key={note.id} note={note} queue={notes} index={i} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'albums' && (
        <section className="creator-profile__tab" aria-label="Albums">
          {creator.albumCount === 0 ? (
            <EmptyState
              icon={<Disc3 />}
              title="NO PUBLIC COLLECTIONS YET."
              body="This creator hasn’t published any albums yet."
            />
          ) : (
            <AlbumGrid creatorId={creator.id} />
          )}
        </section>
      )}

      {tab === 'about' && (
        <section className="creator-profile__tab creator-profile__about" aria-label="About">
          <div className="creator-profile__about-card">
            <h2 className="section-head__title">About</h2>
            <p className="creator-profile__about-bio">{creator.bio}</p>

            <h3 className="creator-profile__about-label micro">Interests &amp; topics</h3>
            <div className="creator-profile__tags">
              {creator.tags.map((tag) => (
                <span key={tag} className="creator-profile__tag">
                  #{tag}
                </span>
              ))}
            </div>

            <dl className="creator-profile__about-stats">
              <div>
                <dt>Joined</dt>
                <dd className="tabular">{formatReleaseDate(creator.joinedAt)}</dd>
              </div>
              <div>
                <dt>VoiceNotes</dt>
                <dd className="tabular">{creator.voiceNoteCount}</dd>
              </div>
              <div>
                <dt>Albums</dt>
                <dd className="tabular">{creator.albumCount}</dd>
              </div>
              <div>
                <dt>Following</dt>
                <dd className="tabular">{formatCount(creator.following)}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}
    </div>
  );
}

/** Public albums by this creator (same data model as Phase 8). */
function AlbumGrid({ creatorId }: { creatorId: string }) {
  const { albums } = useCreatorAlbums(creatorId);
  if (albums.length === 0) return null;
  return (
    <div className="albums-grid">
      {albums.map((album, i) => (
        <AlbumCard key={album.id} album={album} index={i} />
      ))}
    </div>
  );
}

/** Public albums by a creator — reuses the Phase 8 repository. */
function useCreatorAlbums(creatorId: string): { albums: AlbumSummary[] } {
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);

  useEffect(() => {
    let active = true;
    const repo = createAlbumRepository();
    void repo.getAlbums().then((list) => {
      if (!active) return;
      setAlbums(list.filter((a) => a.creatorId === creatorId));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorId]);

  return { albums };
}
