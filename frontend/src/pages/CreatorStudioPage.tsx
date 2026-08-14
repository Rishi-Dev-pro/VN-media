import {
  ArrowLeft,
  Check,
  Disc3,
  Lock,
  Mic2,
  Pause,
  Play,
  Radio,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/common/EmptyState';
import type { VoiceNote } from '../data/types';
import { useVoiceNoteComposer, type DraftUi } from '../hooks/useVoiceNoteComposer';
import { mockAudioSources, type DraftAudio, type VoiceNoteDraft } from '../services/voiceNoteCreationRepository';
import { usePlayer } from '../state/PlayerContext';
import { formatTime } from '../utils/format';
import './CreatorStudioPage.css';

const DEFAULT_ART = '/images/headphones-dark.jpg';

const ARTWORK_OPTIONS = [
  '/images/portrait-1.jpg',
  '/images/portrait-3.jpg',
  '/images/portrait-5.jpg',
  '/images/portrait-7.jpg',
  '/images/portrait-9.jpg',
  '/images/portrait-11.jpg',
  '/images/portrait-13.jpg',
  '/images/headphones-dark.jpg',
  '/images/headphones-teal.jpg',
  '/images/neon-headphones.jpg',
  '/images/forest-mist.jpg',
  '/images/forest-light.jpg',
  '/images/studio-podcast.jpg',
  '/images/studio-neon.jpg',
  '/images/concert-lights.jpg',
  '/images/mic-stage.jpg',
  '/images/hero-headphones.jpg',
  '/images/hero-man.jpg',
  '/images/mountain-peak.jpg',
];

export default function CreatorStudioPage() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const navigate = useNavigate();
  const composer = useVoiceNoteComposer(editId);
  const { play, current, isPlaying, toggle } = usePlayer();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<VoiceNoteDraft | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const leaveCancelRef = useRef<HTMLButtonElement>(null);

  // focus the safest action when the unsaved-changes dialog opens
  useEffect(() => {
    if (leaveOpen) leaveCancelRef.current?.focus();
  }, [leaveOpen]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  /* ---------- unsaved-changes guard ---------- */
  useEffect(() => {
    if (!composer.dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [composer.dirty]);

  const requestLeave = useCallback(() => {
    if (composer.dirty) setLeaveOpen(true);
    else navigate('/profile');
  }, [composer.dirty, navigate]);

  /* ---------- preview note (plays through the global player) ---------- */
  const previewNote: VoiceNote | null = useMemo(() => {
    if (!composer.fields.audio) return null;
    return {
      id: `preview-${composer.draftId ?? 'new'}`,
      title: composer.fields.title.trim() || 'Untitled VoiceNote',
      creatorId: 'crea-you',
      category: composer.fields.category,
      description: composer.fields.description,
      cover: composer.fields.artwork || composer.fields.audio.cover || DEFAULT_ART,
      duration: composer.fields.audio.duration,
      plays: 0,
      likes: 0,
      comments: 0,
      tags: composer.fields.tags,
      releasedAt: new Date().toISOString(),
      visibility: composer.fields.visibility,
    };
  }, [composer.fields, composer.draftId]);

  const previewPlaying = Boolean(
    previewNote && current?.id === previewNote.id && isPlaying,
  );

  const togglePreview = useCallback(() => {
    if (!previewNote) return;
    if (current?.id === previewNote.id) toggle();
    else play(previewNote, [previewNote]);
  }, [previewNote, current, play, toggle]);

  /* ---------- save / publish ---------- */
  const handleSave = useCallback(async () => {
    const ok = await composer.save();
    if (ok) showToast(composer.editing ? 'CHANGES SAVED' : 'DRAFT SAVED');
  }, [composer, showToast]);

  const handlePublishClick = useCallback(() => {
    const v = composer.validate();
    if (v.audio || v.title) {
      showToast('CHECK THE REQUIRED FIELDS');
      return;
    }
    setConfirmOpen(true);
  }, [composer, showToast]);

  const handlePublishConfirm = useCallback(async () => {
    const ok = await composer.publish();
    if (ok) {
      setConfirmOpen(false);
      showToast('VOICE NOTE PUBLISHED');
    }
  }, [composer, showToast]);

  const handleReset = useCallback(() => {
    composer.reset();
    navigate('/create', { replace: true });
  }, [composer, navigate]);

  const openProfile = `/creators/${composer.user?.handle ?? 'you'}`;

  /* ---------- states ---------- */
  if (composer.loading) {
    return (
      <div className="studio" aria-busy="true">
        <div className="skeleton studio-sk-head" style={{ width: '42%', height: 30 }} />
        <div className="studio-grid" aria-hidden="true">
          <div className="skeleton studio-sk-block" />
          <div className="skeleton studio-sk-block" />
        </div>
      </div>
    );
  }

  if (composer.loadError) {
    return (
      <div className="studio">
        <div className="creators-error" role="alert">
          <h2>STUDIO SIGNAL LOST.</h2>
          <p>We couldn’t load your workspace. Try again.</p>
          <button type="button" className="btn btn--ghost" onClick={composer.retry}>
            TRY AGAIN
          </button>
        </div>
      </div>
    );
  }

  if (composer.published) {
    return (
      <div className="studio">
        <SuccessPanel
          note={composer.published}
          profileHref={openProfile}
          onViewDiscover={() => {
            play(composer.published!, [composer.published!]);
            navigate('/discover');
          }}
          onAnother={handleReset}
        />
      </div>
    );
  }

  const f = composer.fields;

  return (
    <div className="studio">
      {/* ---- header ---- */}
      <header className="studio-head">
        <button
          type="button"
          className="studio-head__back micro"
          onClick={requestLeave}
          aria-label="Back to profile"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Profile
        </button>

        <div className="studio-head__title">
          <p className="studio-head__eyebrow micro">
            ✦&nbsp; {composer.editing ? 'Editing VoiceNote' : 'Your studio'} · recording as{' '}
            <strong>@{composer.user?.handle ?? 'you'}</strong>
          </p>
          <h1 className="studio-head__h1">
            {composer.editing ? 'EDIT YOUR VOICE.' : 'CREATE A VOICENOTE.'}
          </h1>
          <p className="studio-head__sub">
            {composer.editing
              ? 'Refine what you already released.'
              : 'Turn a moment into something worth listening to.'}
          </p>
        </div>

        <div className="studio-head__actions">
          {(composer.saveError || composer.publishError) && (
            <p className="studio-head__error" role="alert">
              {composer.saveError ?? composer.publishError}
            </p>
          )}
          <button
            type="button"
            className="btn btn--ghost studio-head__save"
            onClick={() => void handleSave()}
            disabled={composer.saving}
            aria-busy={composer.saving}
          >
            {composer.saving ? (
              <>
                <span className="studio-spin" aria-hidden="true" /> Saving…
              </>
            ) : composer.editing ? (
              <>
                <Check size={15} aria-hidden="true" /> Save changes
              </>
            ) : (
              'Save draft'
            )}
          </button>
          {!composer.editing && (
            <button
              type="button"
              className="btn btn--primary studio-head__publish"
              onClick={handlePublishClick}
              disabled={composer.publishing}
              aria-busy={composer.publishing}
            >
              {composer.publishing ? (
                <>
                  <span className="studio-spin" aria-hidden="true" /> Publishing…
                </>
              ) : (
                <>
                  <Sparkles size={15} aria-hidden="true" /> Publish
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* ---- drafts strip ---- */}
      {!composer.editing && composer.drafts.length > 0 && (
        <DraftsStrip
          drafts={composer.drafts}
          activeDraftId={composer.draftId}
          onResume={composer.loadDraft}
          onDiscard={setDiscardTarget}
        />
      )}

      {/* ---- workspace ---- */}
      <div className="studio-grid">
        <AudioSection
          rec={composer.rec}
          selectedAudio={f.audio}
          onSelectAudio={composer.selectAudio}
          onStartRecord={composer.startRecording}
          onStopRecord={composer.stopRecording}
          onUseRecord={composer.useRecording}
          onDiscardRecord={composer.discardRecording}
          onRemoveAudio={composer.removeAudio}
        />

        <PreviewSection
          note={previewNote}
          playing={previewPlaying}
          playingAny={Boolean(current && isPlaying)}
          onToggle={togglePreview}
          artist={`@${composer.user?.handle ?? 'you'}`}
          visibility={f.visibility}
        />

        <DetailsSection fields={f} composer={composer} />

        <ArtworkSection artwork={f.artwork} onSelect={composer.setArtwork} />

        <VisibilitySection
          value={f.visibility}
          onChange={composer.setVisibility}
        />
      </div>

      {/* ---- publish confirm ---- */}
      {confirmOpen && (
        <ConfirmDialog
          title="READY TO RELEASE?"
          body={`${f.title.trim() || 'Untitled VoiceNote'} · ${f.visibility.toUpperCase()} · ${f.audio ? formatTime(f.audio.duration) : '—'}`}
          confirmLabel={composer.publishing ? 'PUBLISHING…' : 'PUBLISH'}
          busy={composer.publishing}
          error={composer.publishError ?? undefined}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void handlePublishConfirm()}
        />
      )}

      {/* ---- discard draft confirm ---- */}
      {discardTarget && (
        <ConfirmDialog
          title="DISCARD DRAFT?"
          body={`“${discardTarget.title.trim() || 'Untitled draft'}” will be removed. This cannot be undone.`}
          confirmLabel="DISCARD"
          danger
          onCancel={() => setDiscardTarget(null)}
          onConfirm={() => {
            void composer.deleteDraft(discardTarget.id).then(() => {
              setDiscardTarget(null);
              showToast('DRAFT DISCARDED');
            });
          }}
        />
      )}

      {/* ---- unsaved changes ---- */}
      {leaveOpen && (
        <div
          className="studio-dialog-backdrop"
          role="presentation"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setLeaveOpen(false);
          }}
        >
          <div className="studio-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-title">
            <h2 id="leave-title" className="studio-dialog__title">UNSAVED CHANGES</h2>
            <p className="studio-dialog__body">You have changes that haven’t been saved.</p>
            <div className="studio-dialog__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setLeaveOpen(false)}
                ref={leaveCancelRef}
              >
                KEEP EDITING
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setLeaveOpen(false);
                  navigate('/profile');
                }}
              >
                DISCARD
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={composer.saving}
                onClick={() => {
                  void composer.save().then((ok) => {
                    if (ok) {
                      setLeaveOpen(false);
                      navigate('/profile');
                    }
                  });
                }}
              >
                SAVE DRAFT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- toast ---- */}
      {toast && (
        <div className="studio-toast" role="status" aria-live="polite">
          <span className="studio-toast__dot" aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   AUDIO / VOICE
   ============================================================ */

interface AudioSectionProps {
  rec: { state: 'idle' | 'recording' | 'done'; elapsed: number };
  selectedAudio: DraftAudio | null;
  onSelectAudio: (a: DraftAudio) => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onUseRecord: () => void;
  onDiscardRecord: () => void;
  onRemoveAudio: () => void;
}

function AudioSection({
  selectedAudio,
  rec,
  onSelectAudio,
  onStartRecord,
  onStopRecord,
  onUseRecord,
  onDiscardRecord,
  onRemoveAudio,
}: AudioSectionProps) {
  return (
    <section className="studio-card studio-audio" aria-label="Audio source">
      <div className="studio-card__head">
        <h2 className="studio-card__title">
          <Mic2 size={15} aria-hidden="true" /> Audio / Voice
        </h2>
        <span className="studio-card__meta micro">The sound itself</span>
      </div>

      {!selectedAudio && (
        <EmptyState
          icon={<Mic2 />}
          title="NO AUDIO YET."
          body="Every VoiceNote starts somewhere. Pick a demo recording below."
        />
      )}

      <div className="studio-audio__list" role="list" aria-label="Demo audio sources">
        {mockAudioSources.map((src) => {
          const selected = selectedAudio?.id === src.id;
          return (
            <button
              key={src.id}
              type="button"
              role="listitem"
              className={`studio-audio__src ${selected ? 'is-selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelectAudio(src)}
            >
              <span className="studio-audio__src-art">
                <img src={src.cover} alt="" loading="lazy" width={44} height={44} />
              </span>
              <span className="studio-audio__src-body">
                <span className="studio-audio__src-title">{src.title}</span>
                <span className="studio-audio__src-meta micro tabular">
                  {formatTime(src.duration)}
                </span>
              </span>
              <span className="studio-audio__src-wave" aria-hidden="true">
                {src.waveform.slice(0, 24).map((h, i) => (
                  <i key={i} style={{ height: `${Math.max(14, h * 100)}%` }} />
                ))}
              </span>
              {selected && (
                <span className="studio-audio__src-check" aria-hidden="true">
                  <Check size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedAudio && (
        <div className="studio-audio__selected">
          <span className="studio-audio__selected-wave" aria-hidden="true">
            {selectedAudio.waveform.map((h, i) => (
              <i key={i} style={{ height: `${Math.max(12, h * 100)}%` }} />
            ))}
          </span>
          <span className="studio-audio__selected-meta micro">
            {selectedAudio.title} · {formatTime(selectedAudio.duration)}
          </span>
          <button
            type="button"
            className="studio-audio__remove"
            aria-label="Remove audio source"
            onClick={onRemoveAudio}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ---- simulated recording ---- */}
      <div className="studio-rec">
        <p className="studio-rec__label micro">Or simulate a recording</p>
        {rec.state === 'idle' && (
          <button
            type="button"
            className="btn btn--ghost studio-rec__start"
            onClick={onStartRecord}
          >
            <Radio size={15} aria-hidden="true" /> Start recording
          </button>
        )}

        {rec.state === 'recording' && (
          <div className="studio-rec__live" role="status">
            <span className="studio-rec__rec" aria-hidden="true">
              <i /> REC
            </span>
            <span className="studio-rec__timer tabular">{formatTime(rec.elapsed)}</span>
            <button
              type="button"
              className="btn btn--primary studio-rec__stop"
              onClick={onStopRecord}
            >
              Stop
            </button>
          </div>
        )}

        {rec.state === 'done' && (
          <div className="studio-rec__done">
            <p className="studio-rec__done-text micro">
              Recording complete — {formatTime(rec.elapsed)}
            </p>
            <div className="studio-rec__done-actions">
              <button type="button" className="btn btn--primary" onClick={onUseRecord}>
                <Check size={14} aria-hidden="true" /> Use recording
              </button>
              <button type="button" className="btn btn--ghost" onClick={onDiscardRecord}>
                Discard
              </button>
            </div>
          </div>
        )}

        <p className="studio-rec__hint micro">
          Demo only — no microphone is used and nothing is recorded.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   LIVE PREVIEW
   ============================================================ */

interface PreviewSectionProps {
  note: VoiceNote | null;
  playing: boolean;
  playingAny: boolean;
  onToggle: () => void;
  artist: string;
  visibility: 'public' | 'private';
}

function PreviewSection({ note, playing, playingAny, onToggle, artist, visibility }: PreviewSectionProps) {
  const art = note?.cover ?? DEFAULT_ART;
  const title = note?.title ?? 'UNTITLED VOICENOTE';
  return (
    <section className="studio-card studio-preview" aria-label="Live preview">
      <div className="studio-card__head">
        <h2 className="studio-card__title">
          <Disc3 size={15} aria-hidden="true" /> Live preview
        </h2>
        <span className="studio-card__meta micro">How listeners will see it</span>
      </div>

      <div className="studio-preview__art">
        <img src={art} alt={`Artwork for ${title}`} width={320} height={320} />
        <span className="studio-preview__notch" aria-hidden="true" />
        <span className={`studio-preview__vis micro ${visibility === 'private' ? 'is-private' : ''}`}>
          {visibility === 'private' ? 'Private' : 'Public'}
        </span>
      </div>

      <p className="studio-preview__title">{title}</p>
      <p className="studio-preview__artist micro">{artist}</p>

      {note ? (
        <>
          <div className="studio-preview__wave" aria-hidden="true">
            {seededFromTitle(note.title).map((h, i) => (
              <i key={i} className={playing ? 'is-live' : ''} style={{ height: `${Math.max(10, h * 100)}%` }} />
            ))}
          </div>
          <p className="studio-preview__meta micro tabular">
            {formatTime(note.duration)}
            <span aria-hidden="true"> · </span>
            {visibility === 'private' ? 'Only you can hear this' : 'Anyone can discover this'}
          </p>
          <button
            type="button"
            className="btn btn--primary studio-preview__play"
            onClick={onToggle}
            aria-label={playing ? `Pause ${title}` : `Play ${title}`}
          >
            {playing ? (
              <Pause size={15} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={15} fill="currentColor" aria-hidden="true" />
            )}
            {playing ? 'Pause' : 'Play'}
          </button>
        </>
      ) : (
        <p className="studio-preview__hint micro">Add an audio source to preview.</p>
      )}

      <p className="studio-preview__note micro" aria-live="polite">
        {playingAny
          ? 'Preview plays through the global player — it keeps playing if you leave.'
          : 'Playback runs through the global player.'}
      </p>
    </section>
  );
}

/* ============================================================
   DETAILS — title, description, tags, category
   ============================================================ */

function DetailsSection({
  fields,
  composer,
}: {
  fields: DraftUi;
  composer: ReturnType<typeof useVoiceNoteComposer>;
}) {
  const [tagDraft, setTagDraft] = useState('');

  const commitTag = useCallback(() => {
    if (!tagDraft.trim()) return;
    composer.addTag(tagDraft);
    setTagDraft('');
  }, [tagDraft, composer]);

  const titleError = composer.validation.title;

  return (
    <section className="studio-card studio-details" aria-label="VoiceNote details">
      <div className="studio-card__head">
        <h2 className="studio-card__title">Details</h2>
        <span className="studio-card__meta micro">What this voice is about</span>
      </div>

      <div className="studio-field">
        <label className="studio-field__label micro" htmlFor="studio-title">
          Title <span className="studio-field__req" aria-hidden="true">*</span>
        </label>
        <input
          id="studio-title"
          type="text"
          value={fields.title}
          onChange={(e) => composer.setTitle(e.target.value)}
          placeholder="A name worth remembering…"
          aria-invalid={Boolean(titleError)}
          aria-describedby={titleError ? 'studio-title-error' : undefined}
        />
        {titleError && (
          <p id="studio-title-error" className="studio-field__error" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="studio-field">
        <label className="studio-field__label micro" htmlFor="studio-desc">
          Description
        </label>
        <textarea
          id="studio-desc"
          rows={3}
          value={fields.description}
          onChange={(e) => composer.setDescription(e.target.value.slice(0, 280))}
          placeholder="What happened when you pressed record?"
        />
        <span className="studio-field__count micro tabular">{fields.description.length} / 280</span>
      </div>

      <div className="studio-field">
        <span className="studio-field__label micro" id="studio-cat-label">
          Category
        </span>
        <div className="studio-chips" role="group" aria-labelledby="studio-cat-label">
          {composer.categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`studio-chip ${fields.category === c ? 'is-active' : ''}`}
              aria-pressed={fields.category === c}
              onClick={() => composer.setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="studio-field">
        <label className="studio-field__label micro" htmlFor="studio-tag">
          Tags
        </label>
        <div className="studio-tags">
          {fields.tags.map((t) => (
            <span key={t} className="studio-tag">
              #{t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                onClick={() => composer.removeTag(t)}
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
          <span className="studio-tags__input-wrap">
            <span className="studio-tags__hash" aria-hidden="true">#</span>
            <input
              id="studio-tag"
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  commitTag();
                }
              }}
              onBlur={commitTag}
              placeholder={fields.tags.length === 0 ? 'night, field, reflection…' : 'add another'}
              aria-label="Add a tag"
            />
          </span>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   ARTWORK
   ============================================================ */

function ArtworkSection({ artwork, onSelect }: { artwork: string; onSelect: (src: string) => void }) {
  return (
    <section className="studio-card studio-artwork" aria-label="Artwork">
      <div className="studio-card__head">
        <h2 className="studio-card__title">Artwork</h2>
        <span className="studio-card__meta micro">The face of your VoiceNote</span>
      </div>
      <div className="studio-artwork__grid">
        {ARTWORK_OPTIONS.map((src) => {
          const selected = artwork === src;
          return (
            <button
              key={src}
              type="button"
              className={`studio-artwork__opt ${selected ? 'is-selected' : ''}`}
              aria-label={`Use ${src.split('/').pop()?.replace(/\.[a-z]+$/, '')} as artwork`}
              aria-pressed={selected}
              onClick={() => onSelect(src)}
            >
              <img src={src} alt="" loading="lazy" width={64} height={64} />
              {selected && (
                <span className="studio-artwork__check" aria-hidden="true">
                  <Check size={11} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================
   VISIBILITY
   ============================================================ */

function VisibilitySection({
  value,
  onChange,
}: {
  value: 'public' | 'private';
  onChange: (v: 'public' | 'private') => void;
}) {
  return (
    <section className="studio-card studio-visibility" aria-label="Visibility">
      <div className="studio-card__head">
        <h2 className="studio-card__title">Visibility</h2>
        <span className="studio-card__meta micro">Who can find this voice</span>
      </div>

      <div className="studio-visibility__options" role="radiogroup" aria-label="Visibility">
        <label className={`studio-visibility__opt ${value === 'public' ? 'is-active' : ''}`}>
          <input
            type="radio"
            name="studio-visibility"
            value="public"
            checked={value === 'public'}
            onChange={() => onChange('public')}
          />
          <span className="studio-visibility__opt-head">
            <span className="studio-visibility__opt-title">Public</span>
            <span className="studio-visibility__opt-badge micro" aria-hidden="true">
              <span className="studio-visibility__dot" />
            </span>
          </span>
          <span className="studio-visibility__opt-body">
            Anyone can discover and listen to this VoiceNote.
          </span>
        </label>

        <label className={`studio-visibility__opt ${value === 'private' ? 'is-active' : ''}`}>
          <input
            type="radio"
            name="studio-visibility"
            value="private"
            checked={value === 'private'}
            onChange={() => onChange('private')}
          />
          <span className="studio-visibility__opt-head">
            <span className="studio-visibility__opt-title">Private</span>
          <span className="studio-visibility__opt-badge micro is-private" aria-hidden="true">
            <Lock size={10} /> Lock
          </span>
          </span>
          <span className="studio-visibility__opt-body">
            Only you can access this VoiceNote. It never appears publicly.
          </span>
        </label>
      </div>
    </section>
  );
}

/* ============================================================
   DRAFTS STRIP
   ============================================================ */

function DraftsStrip({
  drafts,
  activeDraftId,
  onResume,
  onDiscard,
}: {
  drafts: VoiceNoteDraft[];
  activeDraftId: string | null;
  onResume: (d: VoiceNoteDraft) => void;
  onDiscard: (d: VoiceNoteDraft) => void;
}) {
  return (
    <section className="studio-drafts" aria-label="Your drafts">
      <div className="studio-drafts__head">
        <h2 className="studio-drafts__title micro">Your drafts</h2>
        <span className="studio-drafts__count micro tabular">{drafts.length}</span>
      </div>
      <div className="studio-drafts__list no-scrollbar">
        {drafts.map((d) => (
          <div
            key={d.id}
            className={`studio-drafts__item ${d.id === activeDraftId ? 'is-active' : ''}`}
          >
            <span className="studio-drafts__art">
              <img src={d.artwork || d.audio?.cover || DEFAULT_ART} alt="" loading="lazy" width={34} height={34} />
            </span>
            <span className="studio-drafts__meta">
              <span className="studio-drafts__name">
                {d.title.trim() || 'Untitled draft'}
              </span>
              <span className="studio-drafts__sub micro tabular">
                {d.audio ? formatTime(d.audio.duration) : 'no audio'} · {d.visibility.toLowerCase()}
              </span>
            </span>
            <button
              type="button"
              className="studio-drafts__resume"
              onClick={() => onResume(d)}
            >
              Resume
            </button>
            <button
              type="button"
              className="studio-drafts__trash"
              aria-label={`Discard draft ${d.title || 'untitled'}`}
              onClick={() => onDiscard(d)}
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   CONFIRM DIALOG (same pattern as the rest of the app)
   ============================================================ */

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
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
      className="studio-dialog-backdrop"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="studio-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-dialog-title">
        <h2 id="studio-dialog-title" className="studio-dialog__title">{title}</h2>
        <p className="studio-dialog__body">{body}</p>
        {error && (
          <p className="studio-dialog__error" role="alert">{error}</p>
        )}
        <div className="studio-dialog__actions">
          <button
            type="button"
            className="btn btn--ghost"
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
          >
            {title === 'READY TO RELEASE?' ? 'CANCEL' : 'KEEP DRAFT'}
          </button>
          <button
            type="button"
            className={`btn btn--primary ${danger ? 'studio-dialog__danger' : ''}`}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <span className="studio-spin" aria-hidden="true" /> {confirmLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SUCCESS
   ============================================================ */

function SuccessPanel({
  note,
  profileHref,
  onViewDiscover,
  onAnother,
}: {
  note: VoiceNote;
  profileHref: string;
  onViewDiscover: () => void;
  onAnother: () => void;
}) {
  return (
    <div className="studio-success">
      <p className="studio-success__eyebrow micro">✦&nbsp; Released</p>
      <h1 className="studio-success__title">VOICE NOTE<br />PUBLISHED.</h1>
      <p className="studio-success__sub">
        Your voice is now part of VN-Media.
      </p>

      <div className="studio-success__art">
        <img src={note.cover} alt={`Artwork for ${note.title}`} width={220} height={220} />
        <span className="studio-preview__notch" aria-hidden="true" />
      </div>
      <p className="studio-success__note">{note.title}</p>
      <p className="studio-success__meta micro tabular">
        {formatTime(note.duration)} · {note.visibility === 'private' ? 'Private' : 'Public'}
      </p>

      <div className="studio-success__actions">
        <Link to={profileHref} className="btn btn--primary">
          Open creator profile
        </Link>
        {note.visibility !== 'private' && (
          <button type="button" className="btn btn--ghost" onClick={onViewDiscover}>
            View on Discover
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onAnother}>
          Publish another
        </button>
      </div>
    </div>
  );
}

/** Deterministic waveform for the preview panel. */
function seededFromTitle(title: string): number[] {
  let a = 0;
  for (const ch of title) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
  const wave: number[] = [];
  for (let i = 0; i < 32; i++) {
    a = (a * 1103515245 + 12345) >>> 0;
    wave.push(0.18 + (a % 82) / 100);
  }
  return wave;
}
