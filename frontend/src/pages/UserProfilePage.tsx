import { Calendar, Check, Edit3, Headphones, PlusCircle, Share2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/common/Avatar';
import { SharePanel } from '../components/common/SharePanel';
import { mockCreators } from '../data/mockCreators';
import { useParallax } from '../hooks/useParallax';
import { createAuthRepository, type AuthUser } from '../services/authRepository';
import { createLibraryRepository } from '../services/libraryRepository';
import { useFollows } from '../state/FollowContext';
import './UserProfilePage.css';

const authRepo = createAuthRepository();
const libraryRepo = createLibraryRepository();

/** `/profile?demo=error` forces the error state (deterministic). */
function demoError(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('demo') === 'error';
  } catch {
    return false;
  }
}

/** Local portraits offered as mock avatar choices. */
const AVATAR_OPTIONS = Array.from({ length: 14 }, (_, i) => `/images/portrait-${i + 1}.jpg`);

function formatJoined(iso: string): string {
  try {
    return new Date(iso)
      .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      .toUpperCase();
  } catch {
    return '';
  }
}

export default function UserProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const { followingIds } = useFollows();
  const [library, setLibrary] = useState<{ notes: number; albums: number }>({ notes: 0, albums: 0 });

  const parallaxRef = useParallax<HTMLDivElement>(14, 10);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1900);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        if (demoError()) throw new Error('demo error');
        const [me, lib] = await Promise.all([authRepo.getCurrentUser(), libraryRepo.getLibrary()]);
        if (!active) return;
        setUser(me);
        setLibrary({ notes: lib.savedNotes.length, albums: lib.savedAlbums.length });
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [retryKey]);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  const joinedSince = useMemo(() => (user ? formatJoined('2024-01-10T00:00:00Z') : ''), [user]);

  if (loading) {
    return (
      <div className="user-profile" aria-busy="true">
        <div className="user-profile__hero user-profile__hero--skeleton">
          <div className="skeleton user-profile__sk-art" />
          <div className="user-profile__hero-body">
            <div className="skeleton creators-line" style={{ width: '36%' }} />
            <div className="skeleton creators-line" style={{ width: '46%', height: 34 }} />
            <div className="skeleton creators-line" style={{ width: '88%' }} />
            <div className="skeleton creators-line" style={{ width: '72%' }} />
            <div className="skeleton user-profile__sk-actions" aria-hidden="true" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="user-profile">
        <div className="creators-error" role="alert">
          <h2>PROFILE SIGNAL LOST.</h2>
          <p>Your listening room couldn’t be reached. Try again.</p>
          <button type="button" className="btn btn--ghost" onClick={retry}>
            TRY AGAIN
          </button>
        </div>
      </div>
    );
  }

  const handle = user.handle;

  return (
    <div className="user-profile">
      <div className="user-profile__backdrop" aria-hidden="true">
        <img src={user.avatar} alt="" />
      </div>

      {/* ---- hero ---- */}
      <section className="user-profile__hero">
        <div className="user-profile__media land-rise" style={{ animationDelay: '0.08s' }} ref={parallaxRef}>
          <div className="user-profile__frame">
            <img src={user.avatar} alt={`Your profile picture`} width={560} height={700} />
            <span className="user-profile__notch" aria-hidden="true" />
            <span className="user-profile__scrim" aria-hidden="true" />
            <span className="user-profile__chip micro">
              <Headphones size={10} aria-hidden="true" /> Listener
            </span>
          </div>
        </div>

        <div className="user-profile__info">
          <p className="user-profile__kicker micro">✦&nbsp; Your listening room</p>
          <h1 className="user-profile__name">{user.name}</h1>
          <p className="user-profile__handle">@{handle}</p>
          <p className="user-profile__bio">
            {user.bio ?? 'A quiet listener with a library full of night sounds.'}
          </p>

          <dl className="user-profile__stats">
            <div>
              <dt>Following</dt>
              <dd className="tabular">{followingIds.size}</dd>
            </div>
            <div>
              <dt>Voices saved</dt>
              <dd className="tabular">{library.notes}</dd>
            </div>
            <div>
              <dt>Collections</dt>
              <dd className="tabular">{library.albums}</dd>
            </div>
          </dl>

          <div className="user-profile__actions">
            <button
              type="button"
              className="btn btn--primary user-profile__create"
              onClick={() => navigate('/create')}
            >
              <PlusCircle size={15} aria-hidden="true" /> Create VoiceNote
            </button>
            <button
              type="button"
              className="btn btn--ghost user-profile__edit"
              onClick={() => setEditOpen(true)}
              aria-haspopup="dialog"
            >
              <Edit3 size={15} aria-hidden="true" /> Edit profile
            </button>
            <div className="user-profile__share-wrap">
              <button
                type="button"
                className="btn btn--ghost user-profile__share"
                aria-haspopup="dialog"
                aria-expanded={shareOpen}
                aria-label="Share your profile"
                onClick={() => setShareOpen((v) => !v)}
              >
                <Share2 size={15} aria-hidden="true" /> Share
              </button>
              {shareOpen && (
                <SharePanel url="/profile" username={handle} onClose={() => setShareOpen(false)} />
              )}
            </div>
          </div>

          <p className="user-profile__joined micro">
            <Calendar size={11} aria-hidden="true" /> On VN-Media since {joinedSince}
          </p>
        </div>
      </section>

      {/* ---- about ---- */}
      <section className="user-profile__about" aria-label="About you">
        <div className="user-profile__about-card">
          <h2 className="section-head__title">About you</h2>
          <p className="user-profile__about-bio">
            {user.bio ?? 'A quiet listener with a library full of night sounds.'}
          </p>

          <h3 className="user-profile__about-label micro">Voices you follow</h3>
          {followingIds.size === 0 ? (
            <p className="user-profile__about-empty">
              You’re not following anyone yet — your listening room is quiet.
            </p>
          ) : (
            <YourVoices />
          )}
        </div>
      </section>

      {/* ---- edit profile dialog ---- */}
      {editOpen && (
        <EditProfileDialog
          user={user}
          onClose={() => setEditOpen(false)}
          onSaved={(next) => {
            setUser(next);
            setEditOpen(false);
            showToast('PROFILE UPDATED');
          }}
        />
      )}

      {/* ---- toast ---- */}
      {toast && (
        <div className="user-profile__toast" role="status" aria-live="polite">
          <span className="user-profile__toast-dot" aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Voices you follow — the social graph, one boundary.
   ============================================================ */

function YourVoices() {
  const { followingIds } = useFollows();

  const creators = useMemo(() => {
    return Array.from(followingIds)
      .map((id) => mockCreators.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [followingIds]);

  if (creators.length === 0) return null;

  return (
    <div className="user-profile__voices">
      {creators.map((c) => (
        <Link
          key={c.id}
          to={`/creators/${c.handle}`}
          className="user-profile__voice"
          aria-label={`Open profile of ${c.name}`}
        >
          <Avatar src={c.avatar} alt={c.name} size={34} />
          <span className="user-profile__voice-meta">
            <span className="user-profile__voice-name">{c.name}</span>
            <span className="user-profile__voice-handle">@{c.handle}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ============================================================
   Edit profile dialog — username / avatar / bio with the same
   validation rules as Register, resolved through the repo.
   ============================================================ */

function EditProfileDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AuthUser;
  onClose: () => void;
  onSaved: (user: AuthUser) => void;
}) {
  const [username, setUsername] = useState(user.handle);
  const [avatar, setAvatar] = useState(user.avatar);
  const [bio, setBio] = useState(user.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    const res = await authRepo.updateCurrentUser({
      handle: username,
      avatar,
      bio,
    });
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    onSaved(res.user);
  }, [username, avatar, bio, onSaved]);

  return (
    <div
      className="user-profile__dialog-backdrop"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="user-profile__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-dialog-title"
      >
        <div className="user-profile__dialog-head">
          <div>
            <p className="user-profile__dialog-kicker micro">Your room, your name</p>
            <h2 id="user-profile-dialog-title" className="user-profile__dialog-title">
              EDIT PROFILE
            </h2>
          </div>
          <button
            type="button"
            className="user-profile__dialog-close"
            aria-label="Close edit profile"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <label className="user-profile__field">
          <span className="user-profile__field-label micro">Username</span>
          <span className="user-profile__input-wrap">
            <span className="user-profile__field-prefix" aria-hidden="true">@</span>
            <input
              ref={firstFieldRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-label="Username"
              autoComplete="off"
              spellCheck={false}
            />
          </span>
          {saveError && <span className="user-profile__field-error" role="alert">{saveError}</span>}
        </label>

        <fieldset className="user-profile__field user-profile__avatar-field">
          <legend className="user-profile__field-label micro">Avatar</legend>
          <div className="user-profile__avatar-grid">
            {AVATAR_OPTIONS.map((src) => (
              <button
                key={src}
                type="button"
                className={`user-profile__avatar-option ${avatar === src ? 'is-selected' : ''}`}
                aria-label={`Choose ${src.split('/').pop()}`}
                aria-pressed={avatar === src}
                onClick={() => setAvatar(src)}
              >
                <Avatar src={src} alt="" size={46} />
                {avatar === src && (
                  <span className="user-profile__avatar-check" aria-hidden="true">
                    <Check size={11} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="user-profile__field">
          <span className="user-profile__field-label micro">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 180))}
            rows={3}
            aria-label="Bio"
            placeholder="A sentence about what you listen to."
          />
          <span className="user-profile__field-count micro tabular">{bio.length} / 180</span>
        </label>

        <div className="user-profile__dialog-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            CANCEL
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void save()}
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? (
              <>
                <span className="user-profile__saving" aria-hidden="true" /> Saving…
              </>
            ) : (
              <>
                <Check size={15} aria-hidden="true" /> Save changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
