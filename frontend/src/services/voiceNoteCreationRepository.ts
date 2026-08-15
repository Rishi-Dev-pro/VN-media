import type { Category, VoiceNote } from '../data/types';
import { addVoiceNote, mockVoiceNotes } from '../data/mockVoiceNotes';
import { SELF_CREATOR_ID } from '../data/mockCreators';
import { seededWave } from '../utils/waveform';
import { isApiMode } from './api/apiConfig';
import { httpVoiceNoteCreationRepository } from './api/httpVoiceNoteCreationRepository';

/* ============================================================
   VoiceNote creation repository boundary.

   The studio owns the creator's drafting + publishing workflow.
   Everything is session-local mock state (same strategy as the
   message / notification repositories): drafts live here, and
   publishing writes through `addVoiceNote` into the shared
   catalog — so a public note flows to Discover, Search, the
   creator profile and the player without any other system
   changing. Phase 18 swaps this file for the real API.
   ============================================================ */

/** A mock audio source the creator can build a draft around. */
export interface DraftAudio {
  id: string;
  title: string;
  /** duration in seconds */
  duration: number;
  cover: string;
  /** deterministic waveform bars (0..1) */
  waveform: number[];
}

export interface VoiceNoteDraft {
  id: string;
  creatorId: string;
  status: 'draft' | 'published';
  title: string;
  description: string;
  tags: string[];
  category: Category;
  artwork: string;
  audio: DraftAudio | null;
  visibility: 'public' | 'private';
  /** epoch ms */
  createdAt: number;
  /** epoch ms */
  updatedAt: number;
  /** set once a draft has been published */
  publishedNoteId?: string;
}

export interface DraftInput {
  /** id of an existing draft to update (omit to create a new one) */
  draftId?: string;
  title: string;
  description: string;
  tags: string[];
  category: Category;
  artwork: string;
  audio: DraftAudio | null;
  visibility: 'public' | 'private';
}

export interface VoiceNoteCreationRepository {
  /** drafts owned by the current user, newest first */
  getMyDrafts(): Promise<VoiceNoteDraft[]>;
  getDraft(draftId: string): Promise<VoiceNoteDraft | null>;
  /** upsert — creates a draft or updates the one named by draftId */
  saveDraft(input: DraftInput): Promise<VoiceNoteDraft>;
  deleteDraft(draftId: string): Promise<void>;
  /** validates + publishes, writing the note into the shared catalog */
  publishDraft(draftId: string): Promise<VoiceNote>;
  /** a published note the current user owns, shaped for editing */
  getEditableNote(noteId: string): Promise<VoiceNoteDraft | null>;
  /** save edits back onto a published note (stable id) */
  updateNote(noteId: string, input: DraftInput): Promise<VoiceNote>;
}

/** Simulated latency so loading / saving states are real. */
const delay = (ms = 520) => new Promise<void>((r) => setTimeout(r, ms));

/* ---------- demo switches (deterministic) ---------- */

function demo(flag: string): boolean {
  try {
    return new URLSearchParams(window.location.search).get('demo') === flag;
  } catch {
    return false;
  }
}

/* ---------- mock audio palette ---------- */

const AUDIO_SEEDS: { id: string; title: string; duration: number; cover: string; seed: number }[] = [
  { id: 'src-letters', title: 'Letters I Never Sent', duration: 222, cover: '/images/hero-headphones.jpg', seed: 11 },
  { id: 'src-rain-window', title: 'Rain on the Window', duration: 491, cover: '/images/forest-mist.jpg', seed: 23 },
  { id: 'src-late-monologue', title: 'Late Night Monologue', duration: 328, cover: '/images/mic-stage.jpg', seed: 37 },
  { id: 'src-empty-platform', title: 'Empty Platform', duration: 249, cover: '/images/concert-lights.jpg', seed: 53 },
];

/** Deterministic demo audio sources the creator can select. */
export const mockAudioSources: DraftAudio[] = AUDIO_SEEDS.map((s) => ({
  id: s.id,
  title: s.title,
  duration: s.duration,
  cover: s.cover,
  waveform: seededWave(s.seed, 48),
}));

/* ---------- session state ---------- */

const stateDrafts: Map<string, VoiceNoteDraft> = new Map();
let draftSeq = 0;
let noteSeq = 0;

function nextDraftId(): string {
  draftSeq += 1;
  return `draft-${draftSeq}`;
}

function nextNoteId(): string {
  noteSeq += 1;
  return `vn-own-${noteSeq}`;
}

function emptyAudio(): DraftAudio {
  return {
    id: 'src-silence',
    title: 'No audio source',
    duration: 0,
    cover: '/images/headphones-dark.jpg',
    waveform: seededWave(7, 48),
  };
}

/** Build the publishable VoiceNote shape from a draft. */
function materialize(draft: VoiceNoteDraft): VoiceNote {
  const audio = draft.audio ?? emptyAudio();
  return {
    id: draft.publishedNoteId ?? nextNoteId(),
    title: draft.title.trim(),
    creatorId: draft.creatorId,
    category: draft.category,
    description: draft.description.trim(),
    cover: draft.artwork,
    duration: Math.max(1, Math.round(audio.duration)),
    plays: 0,
    likes: 0,
    comments: 0,
    tags: draft.tags,
    releasedAt: new Date().toISOString(),
    visibility: draft.visibility,
  };
}

export const mockVoiceNoteCreationRepository: VoiceNoteCreationRepository = {
  async getMyDrafts() {
    await delay(420);
    if (demo('error')) throw new Error('Mock studio failed (demo)');
    return [...stateDrafts.values()]
      .filter((d) => d.status === 'draft')
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async getDraft(draftId) {
    await delay(360);
    if (demo('error')) throw new Error('Mock studio failed (demo)');
    const d = stateDrafts.get(draftId);
    return d ? { ...d, audio: d.audio ? { ...d.audio } : null, tags: [...d.tags] } : null;
  },

  async saveDraft(input) {
    await delay(620);
    if (demo('error')) throw new Error('Mock save failed (demo)');

    const now = Date.now();
    let draft: VoiceNoteDraft;
    if (input.draftId && stateDrafts.has(input.draftId)) {
      const prev = stateDrafts.get(input.draftId)!;
      draft = { ...prev, updatedAt: now };
    } else {
      draft = {
        id: input.draftId ?? nextDraftId(),
        creatorId: SELF_CREATOR_ID,
        status: 'draft',
        title: '',
        description: '',
        tags: [],
        category: 'Ambient',
        artwork: '',
        audio: null,
        visibility: 'public',
        createdAt: now,
        updatedAt: now,
      };
    }

    draft.title = input.title;
    draft.description = input.description;
    draft.tags = [...input.tags];
    draft.category = input.category;
    draft.artwork = input.artwork;
    draft.audio = input.audio ? { ...input.audio, waveform: [...input.audio.waveform] } : null;
    draft.visibility = input.visibility;

    stateDrafts.set(draft.id, draft);
    return { ...draft, audio: draft.audio ? { ...draft.audio } : null, tags: [...draft.tags] };
  },

  async deleteDraft(draftId) {
    await delay(300);
    stateDrafts.delete(draftId);
  },

  async publishDraft(draftId) {
    await delay(900);
    if (demo('publish-error')) throw new Error('Mock publish failed (demo)');

    const draft = stateDrafts.get(draftId);
    if (!draft) throw new Error('Draft not found');
    if (!draft.audio) throw new Error('Audio required');
    if (!draft.title.trim()) throw new Error('Title required');

    const note = materialize(draft);
    addVoiceNote(note);

    draft.status = 'published';
    draft.publishedNoteId = note.id;
    draft.updatedAt = Date.now();

    return { ...note };
  },

  async getEditableNote(noteId) {
    await delay(420);
    if (demo('error')) throw new Error('Mock studio failed (demo)');
    const note = mockVoiceNotes.find((n) => n.id === noteId && n.creatorId === SELF_CREATOR_ID);
    if (!note) return null;
    return {
      id: `edit-${noteId}`,
      creatorId: SELF_CREATOR_ID,
      status: 'published',
      title: note.title,
      description: note.description,
      tags: [...note.tags],
      category: note.category,
      artwork: note.cover,
      audio: {
        id: `src-${note.id}`,
        title: note.title,
        duration: note.duration,
        cover: note.cover,
        waveform: seededWave(note.id.length * 31 + 5, 48),
      },
      visibility: note.visibility ?? 'public',
      createdAt: +new Date(note.releasedAt),
      updatedAt: +new Date(note.releasedAt),
      publishedNoteId: note.id,
    };
  },

  async updateNote(noteId, input) {
    await delay(640);
    if (demo('error')) throw new Error('Mock save failed (demo)');

    const note = mockVoiceNotes.find((n) => n.id === noteId && n.creatorId === SELF_CREATOR_ID);
    if (!note) throw new Error('Note not found');

    const audio = input.audio;
    note.title = input.title.trim();
    note.description = input.description.trim();
    note.tags = [...input.tags];
    note.category = input.category;
    note.cover = input.artwork;
    note.duration = Math.max(1, Math.round(audio?.duration ?? 0));
    note.visibility = input.visibility;

    return { ...note };
  },
};

/** Single access point — mode switch lives here. */
export function createVoiceNoteCreationRepository(): VoiceNoteCreationRepository {
  return isApiMode ? httpVoiceNoteCreationRepository : mockVoiceNoteCreationRepository;
}
