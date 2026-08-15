import {
  ArrowLeft,
  Calendar,
  Check,
  Disc3,
  MessageCircle,
  Mic2,
  Pause,
  Play,
  Plus,
  Radio,
  Share2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlbumCard } from '../components/albums/AlbumCard';
import { CommentsDrawer } from '../components/comments/CommentsDrawer';
import { EmptyState } from '../components/common/EmptyState';
import { SharePanel } from '../components/common/SharePanel';
import { FeedCard } from '../components/voiceNotes/FeedCard';
import type { Creator, VoiceNote } from '../data/types';
import { notesByCreator, DEMO_NOW } from '../data/mockFollowing';
import { useCreator } from '../hooks/useCreators';
import { useParallax } from '../hooks/useParallax';
import { createAlbumRepository, type AlbumSummary } from '../services/albumRepository';
import { createMessageRepository } from '../services/messageRepository';
import { useFollows } from '../state/FollowContext';
import { usePlayer } from '../state/PlayerContext';
import { formatCount, formatRelative, formatTime } from '../utils/format';
import './CreatorProfilePage.css';

type ProfileTab = 'notes' | 'albums' | 'about';

/** "2024-03-12T00:00:00Z" -> "MAR 2024" (kept intentionally coarse). */
function formatJoined(iso: string): string {
  try {
    return new Date(iso)
      .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      .toUpperCase();
  } catch {
    return '';
  }
}

export default function CreatorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { creator, loading, error, retry } = useCreator(username);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isFollowing, toggleFollow } = useFollows();

  const tab = (searchParams.get('tab') as ProfileTab) ?? 'notes';
  const setTab = useCallback(
    (t: ProfileTab) => setSearchParams(t === 'notes' ? {} : { tab: t }, { replace: true }),
    [setSearchParams],
  );

  const [messaging, setMessaging] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsNote, setCommentsNote] = useState<VoiceNote | null>(null);
  const parallaxRef = useParallax<HTMLDivElement>(14, 10);

  const notes = useMemo(
    () => (creator ? notesByCreator(creator.id) : []),
    [creator],
  );

  /* ----- message -> existing conversation (or a fresh thread) ----- */
  const openMessage = useCallback(async () => {
    if (!creator) return;
    setMessaging(true);
    try {
      const id = await createMessageRepository().getOrCreateConversation(creator.id);
      navigate(`/messages/${id}`);
    } finally {
      setMessaging(false);
    }
  }, [creator, navigate]);

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
            <div className="skeleton creator-profile__sk-actions" aria-hidden="true" />
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
          <h2>{error ? 'CREATOR SIGNAL LOST.' : 'THIS CREATOR DOESN’T EXIST.'}</h2>
          <p>
            {error
              ? 'This listening room couldn’t be reached.'
              : 'The room you’re looking for isn’t here.'}
          </p>
          {error ? (
            <button type="button" className="btn btn--ghost" onClick={retry}>
              TRY AGAIN
            </button>
          ) : (
            <Link to="/creators" className="btn btn--ghost">
              BACK TO CREATORS
            </Link>
          )}
        </div>
      </div>
    );
  }

  const followed = isFollowing(creator.id);
  const followers = creator.followers + (followed ? 1 : 0);
  const joinedSince = formatJoined(creator.joinedAt);
  const featured = notes[0];

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
        <div className="creator-profile__media land-rise" style={{ animationDelay: '0.08s' }} ref={parallaxRef}>
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
              aria-label={followed ? `Unfollow ${creator.name}` : `Follow ${creator.name}`}
              onClick={() => toggleFollow(creator.id)}
            >
              {followed ? (
                <>
                  <span className="creator-profile__follow-label creator-profile__follow-label--on">
                    <Check size={15} aria-hidden="true" /> Following
                  </span>
                  <span className="creator-profile__follow-label creator-profile__follow-label--off">
                    <X size={15} aria-hidden="true" /> Unfollow
                  </span>
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
              onClick={() => void openMessage()}
              disabled={messaging}
              aria-label={`Message ${creator.name}`}
            >
              <MessageCircle size={15} aria-hidden="true" /> {messaging ? 'Opening…' : 'Message'}
            </button>
            <div className="creator-profile__share-wrap">
              <button
                type="button"
                className="btn btn--ghost creator-profile__share"
                aria-haspopup="dialog"
                aria-expanded={shareOpen}
                aria-label={`Share ${creator.name}'s profile`}
                onClick={() => setShareOpen((v) => !v)}
              >
                <Share2 size={15} aria-hidden="true" /> Share
              </button>
              {shareOpen && (
                <SharePanel
                  url={`/creators/${creator.handle}`}
                  username={creator.handle}
                  onClose={() => setShareOpen(false)}
                />
              )}
            </div>
          </div>

          <p className="creator-profile__joined micro">
            <Calendar size={11} aria-hidden="true" /> On VN-Media since {joinedSince}
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
          {notes.length > 0 && featured && (
            <FeaturedNote note={featured} queue={notes} creator={creator} />
          )}
          {notes.length === 0 ? (
            <EmptyState
              icon={<Mic2 />}
              title="NO VOICES YET."
              body="This creator hasn’t released a public VoiceNote."
            />
          ) : (
            <>
              {creator.voiceNoteCount > 0 && (
                <p className="creator-profile__activity micro">
                  <Radio size={11} aria-hidden="true" /> Recently published — newest first
                </p>
              )}
              {notes.length > 1 && (
                <div className="creator-profile__list">
                  {notes.slice(1).map((note, i) => (
                    <FeedCard
                      key={note.id}
                      note={note}
                      queue={notes}
                      index={i}
                      onOpenComments={setCommentsNote}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'albums' && (
        <section className="creator-profile__tab" aria-label="Albums">
          {creator.albumCount === 0 ? (
            <EmptyState
              icon={<Disc3 />}
              title="NO PUBLIC COLLECTIONS."
              body="Nothing public here yet."
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
                <dt>On VN-Media since</dt>
                <dd className="tabular">{joinedSince}</dd>
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

      <CommentsDrawer note={commentsNote} onClose={() => setCommentsNote(null)} />
    </div>
  );
}

/* ============================================================
   Featured VoiceNote — the creator's newest public note,
   one cinematic focal card wired to the global player.
   ============================================================ */

function FeaturedNote({
  note,
  queue,
  creator,
}: {
  note: VoiceNote;
  queue: VoiceNote[];
  creator: Creator;
}) {
  const { current, isPlaying, play, toggle } = usePlayer();
  const isCurrent = current?.id === note.id;
  const playing = isCurrent && isPlaying;

  const activate = useCallback(() => {
    if (isCurrent) toggle();
    else play(note, queue, undefined, creator.name.toUpperCase());
  }, [isCurrent, note, queue, play, toggle, creator.name]);

  // a follow here lands in the same notification stream the
  // repository boundary already owns (single social graph)
  const { isFollowing, toggleFollow } = useFollows();
  const followed = isFollowing(creator.id);

  return (
    <section className="creator-profile__featured" aria-label={`Latest from ${creator.name}`}>
      <div className="creator-profile__featured-art">
        <img src={note.cover} alt={`Cover art of ${note.title}`} width={420} height={420} />
        <span className="creator-profile__featured-notch" aria-hidden="true" />
        <span className="creator-profile__featured-chip micro">
          <Radio size={10} aria-hidden="true" /> Latest
        </span>
      </div>

      <div className="creator-profile__featured-body">
        <p className="creator-profile__featured-kicker micro">Latest from {creator.name}</p>
        <h3 className="creator-profile__featured-title">{note.title}</h3>
        <p className="creator-profile__featured-desc">{note.description}</p>

        <p className="creator-profile__featured-meta micro tabular">
          <span>{formatTime(note.duration)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatRelative(note.releasedAt, DEMO_NOW)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatCount(note.plays)} plays</span>
          <span aria-hidden="true">·</span>
          <span>{formatCount(note.likes)} likes</span>
        </p>

        <div className="creator-profile__featured-actions">
          <button
            type="button"
            className="btn btn--primary creator-profile__featured-play"
            onClick={activate}
            aria-label={`${playing ? 'Pause' : 'Play'} ${note.title}`}
          >
            {playing ? <Pause size={15} fill="currentColor" aria-hidden="true" /> : <Play size={15} fill="currentColor" aria-hidden="true" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className={`btn btn--ghost creator-profile__featured-follow ${followed ? 'is-following' : ''}`}
            aria-pressed={followed}
            aria-label={followed ? `Unfollow ${creator.name}` : `Follow ${creator.name}`}
            onClick={() => toggleFollow(creator.id)}
          >
            {followed ? 'Following' : 'Follow'}
          </button>
        </div>
      </div>
    </section>
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
