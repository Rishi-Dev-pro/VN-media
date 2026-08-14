import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, VoiceNote } from '../data/types';
import { createAuthRepository, type AuthUser } from '../services/authRepository';
import {
  createVoiceNoteCreationRepository,
  type DraftAudio,
  type VoiceNoteDraft,
} from '../services/voiceNoteCreationRepository';
import { seededWave } from '../utils/waveform';

/* ============================================================
   useVoiceNoteComposer — the studio's business logic.

   UI only talks to this hook; the hook talks to the creation
   repository. Draft fields, validation, save / publish / edit,
   the simulated recording timer and dirty tracking all live
   here so the page stays presentational.
   ============================================================ */

export type RecordingState = { state: 'idle' | 'recording' | 'done'; elapsed: number };

export interface DraftUi {
  title: string;
  description: string;
  tags: string[];
  category: Category;
  artwork: string;
  audio: DraftAudio | null;
  visibility: 'public' | 'private';
}

export interface ComposerValidation {
  audio?: string;
  title?: string;
}

const CATEGORIES: Category[] = ['Ambient', 'Story', 'Field', 'Lo-Fi', 'Talk', 'Textures'];

const EMPTY_FIELDS: DraftUi = {
  title: '',
  description: '',
  tags: [],
  category: 'Ambient',
  artwork: '',
  audio: null,
  visibility: 'public',
};

const repo = createVoiceNoteCreationRepository();
const authRepo = createAuthRepository();

function serialize(f: DraftUi): string {
  return JSON.stringify({
    t: f.title,
    d: f.description,
    g: f.tags,
    c: f.category,
    a: f.artwork,
    u: f.audio?.id,
    v: f.visibility,
  });
}

export function useVoiceNoteComposer(editNoteId: string | null) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const [drafts, setDrafts] = useState<VoiceNoteDraft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [publishedNoteId, setPublishedNoteId] = useState<string | null>(editNoteId);
  const [fields, setFields] = useState<DraftUi>(EMPTY_FIELDS);
  const [dirty, setDirty] = useState(false);

  const [validation, setValidation] = useState<ComposerValidation>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState<VoiceNote | null>(null);
  const [rec, setRec] = useState<RecordingState>({ state: 'idle', elapsed: 0 });

  const snapshotRef = useRef(serialize(EMPTY_FIELDS));
  const recTimer = useRef<number | null>(null);

  /* ---------- load: current user + drafts + optional edit target ---------- */
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    setPublished(null);
    setPublishError(null);
    setSaveError(null);
    void (async () => {
      try {
        const [me, myDrafts, editable] = await Promise.all([
          authRepo.getCurrentUser(),
          repo.getMyDrafts(),
          editNoteId ? repo.getEditableNote(editNoteId) : Promise.resolve(null),
        ]);
        if (!active) return;
        setUser(me);
        setDrafts(myDrafts);
        if (editable) {
          setFields({
            title: editable.title,
            description: editable.description,
            tags: editable.tags,
            category: editable.category,
            artwork: editable.artwork,
            audio: editable.audio,
            visibility: editable.visibility,
          });
          setPublishedNoteId(editable.publishedNoteId ?? editNoteId);
          snapshotRef.current = serialize({
            title: editable.title,
            description: editable.description,
            tags: editable.tags,
            category: editable.category,
            artwork: editable.artwork,
            audio: editable.audio,
            visibility: editable.visibility,
          });
        } else if (editNoteId) {
          // the note doesn't exist or isn't ours — fall back to a fresh draft
          setPublishedNoteId(null);
        }
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [editNoteId, retryKey]);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  /* ---------- recording timer (deterministic, always cleaned up) ---------- */
  useEffect(() => {
    if (rec.state !== 'recording') return;
    recTimer.current = window.setInterval(() => {
      setRec((r) =>
        r.state === 'recording' ? { ...r, elapsed: Math.min(r.elapsed + 1, 15 * 60) } : r,
      );
    }, 1000);
    return () => {
      if (recTimer.current) window.clearInterval(recTimer.current);
    };
  }, [rec.state]);

  useEffect(
    () => () => {
      if (recTimer.current) window.clearInterval(recTimer.current);
    },
    [],
  );

  /* ---------- dirty tracking ---------- */
  const markDirty = useCallback((next: DraftUi) => {
    setFields(next);
    setDirty(serialize(next) !== snapshotRef.current);
  }, []);

  /* ---------- field setters ---------- */
  const setTitle = useCallback(
    (title: string) => markDirty({ ...fields, title }),
    [fields, markDirty],
  );
  const setDescription = useCallback(
    (description: string) => markDirty({ ...fields, description }),
    [fields, markDirty],
  );
  const setCategory = useCallback(
    (category: Category) => markDirty({ ...fields, category }),
    [fields, markDirty],
  );
  const setArtwork = useCallback(
    (artwork: string) => markDirty({ ...fields, artwork }),
    [fields, markDirty],
  );
  const setVisibility = useCallback(
    (visibility: 'public' | 'private') => markDirty({ ...fields, visibility }),
    [fields, markDirty],
  );

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim().replace(/^#/, '').toLowerCase();
      if (!tag) return;
      if (fields.tags.some((t) => t === tag)) return;
      markDirty({ ...fields, tags: [...fields.tags, tag] });
    },
    [fields, markDirty],
  );

  const removeTag = useCallback(
    (tag: string) => {
      markDirty({ ...fields, tags: fields.tags.filter((t) => t !== tag) });
    },
    [fields, markDirty],
  );

  const selectAudio = useCallback(
    (audio: DraftAudio) => {
      markDirty({
        ...fields,
        audio,
        // the audio's own cover makes a sensible default artwork
        artwork: fields.artwork || audio.cover,
      });
    },
    [fields, markDirty],
  );

  const removeAudio = useCallback(() => {
    markDirty({ ...fields, audio: null });
  }, [fields, markDirty]);

  /* ---------- recording flow ---------- */
  const startRecording = useCallback(() => {
    setRec({ state: 'recording', elapsed: 0 });
  }, []);

  const stopRecording = useCallback(() => {
    setRec((r) => (r.state === 'recording' ? { ...r, state: 'done' } : r));
  }, []);

  const useRecording = useCallback(() => {
    const elapsed = Math.max(1, rec.elapsed);
    const audio: DraftAudio = {
      id: `rec-${Date.now()}`,
      title: 'Studio Recording',
      duration: elapsed,
      cover: fields.artwork || '/images/headphones-dark.jpg',
      waveform: seededWave(elapsed * 7 + 1, 48),
    };
    setRec({ state: 'idle', elapsed: 0 });
    markDirty({ ...fields, audio });
  }, [rec.elapsed, fields, markDirty]);

  const discardRecording = useCallback(() => {
    setRec({ state: 'idle', elapsed: 0 });
  }, []);

  /* ---------- validation ---------- */
  const validate = useCallback((): ComposerValidation => {
    const v: ComposerValidation = {};
    if (!fields.audio) v.audio = 'ADD AN AUDIO SOURCE.';
    if (!fields.title.trim()) v.title = 'GIVE YOUR VOICENOTE A TITLE.';
    setValidation(v);
    return v;
  }, [fields.audio, fields.title]);

  /* ---------- save ---------- */
  const save = useCallback(async (): Promise<boolean> => {
    setSaveError(null);
    setSaving(true);
    try {
      if (publishedNoteId) {
        // edits save straight back onto the published note — no success panel
        await repo.updateNote(publishedNoteId, { ...fields, draftId: undefined });
        snapshotRef.current = serialize(fields);
        setDirty(false);
        setDraftId(null);
        return true;
      }
      const draft = await repo.saveDraft({ draftId: draftId ?? undefined, ...fields });
      setDraftId(draft.id);
      snapshotRef.current = serialize(fields);
      setDirty(false);
      const list = await repo.getMyDrafts();
      setDrafts(list);
      return true;
    } catch {
      setSaveError("COULDN'T SAVE DRAFT.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [fields, draftId, publishedNoteId]);

  /* ---------- publish ---------- */
  const publish = useCallback(async (): Promise<boolean> => {
    const v = validate();
    if (v.audio || v.title) return false;

    setPublishError(null);
    setPublishing(true);
    try {
      // ensure the draft exists so publish has something to release
      let id = draftId;
      if (!id) {
        const draft = await repo.saveDraft({ draftId: undefined, ...fields });
        id = draft.id;
        setDraftId(id);
      }
      const note = await repo.publishDraft(id);
      setPublished(note);
      setPublishedNoteId(note.id);
      setDraftId(null);
      snapshotRef.current = serialize(fields);
      setDirty(false);
      const list = await repo.getMyDrafts();
      setDrafts(list);
      return true;
    } catch {
      setPublishError('PUBLISH SIGNAL LOST.');
      return false;
    } finally {
      setPublishing(false);
    }
  }, [fields, draftId, validate]);

  /* ---------- drafts ---------- */
  const loadDraft = useCallback((d: VoiceNoteDraft) => {
    setDraftId(d.id);
    setPublishedNoteId(null);
    setPublished(null);
    const next: DraftUi = {
      title: d.title,
      description: d.description,
      tags: d.tags,
      category: d.category,
      artwork: d.artwork,
      audio: d.audio,
      visibility: d.visibility,
    };
    setFields(next);
    snapshotRef.current = serialize(next);
    setDirty(false);
    setValidation({});
  }, []);

  const deleteDraft = useCallback(
    async (id: string) => {
      await repo.deleteDraft(id);
      const list = await repo.getMyDrafts();
      setDrafts(list);
    },
    [],
  );

  const reset = useCallback(() => {
    setFields(EMPTY_FIELDS);
    setDraftId(null);
    setPublishedNoteId(null);
    setPublished(null);
    setDirty(false);
    setValidation({});
    setSaveError(null);
    setPublishError(null);
    snapshotRef.current = serialize(EMPTY_FIELDS);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      loadError,
      retry,
      drafts,
      fields,
      dirty,
      validation,
      saving,
      saveError,
      publishing,
      publishError,
      published,
      publishedNoteId,
      draftId,
      rec,
      editing: Boolean(publishedNoteId),
      categories: CATEGORIES,
      setTitle,
      setDescription,
      setCategory,
      setArtwork,
      setVisibility,
      addTag,
      removeTag,
      selectAudio,
      removeAudio,
      startRecording,
      stopRecording,
      useRecording,
      discardRecording,
      validate,
      save,
      publish,
      loadDraft,
      deleteDraft,
      reset,
    }),
    [
      user,
      loading,
      loadError,
      retry,
      drafts,
      fields,
      dirty,
      validation,
      saving,
      saveError,
      publishing,
      publishError,
      published,
      publishedNoteId,
      draftId,
      rec,
      setTitle,
      setDescription,
      setCategory,
      setArtwork,
      setVisibility,
      addTag,
      removeTag,
      selectAudio,
      removeAudio,
      startRecording,
      stopRecording,
      useRecording,
      discardRecording,
      validate,
      save,
      publish,
      loadDraft,
      deleteDraft,
      reset,
    ],
  );

  return value;
}
