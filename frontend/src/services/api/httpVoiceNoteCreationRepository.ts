/* ============================================================
   HTTP voice-note creation repository (Phase 18, API mode).

     POST /api/vns               multipart upload (audio + metadata)
     PATCH /api/vns/:id          metadata update
     GET  /api/vns/:id           editable note lookup (owner)

   Drafts stay session-local (the backend has no draft API —
   documented UX state). Publishing uploads a deterministic WAV of
   the draft's chosen duration through the real pipeline, so the
   created note is a real backend entity with real audioUrl and
   streams through the authorized endpoint. No local catalog
   injection — the server is the source of truth.
   ============================================================ */

import type {
  VoiceNoteCreationRepository,
  VoiceNoteDraft,
} from '../voiceNoteCreationRepository';
import { apiRequest } from './apiClient';
import { mapVoiceNote, type BackendVoiceNote } from './mappers';
import { buildDemoWavBlob } from '../../utils/wav';
import { seededWave } from '../../utils/waveform';
import { cacheNote } from './identity';
import { getSessionUser } from './session';

const drafts = new Map<string, VoiceNoteDraft>();
let draftSeq = 0;

function nextDraftId(): string {
  draftSeq += 1;
  return `draft-${draftSeq}`;
}

export const httpVoiceNoteCreationRepository: VoiceNoteCreationRepository = {
  async getMyDrafts() {
    return [...drafts.values()]
      .filter((d) => d.status === 'draft')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(cloneDraft);
  },

  async getDraft(draftId) {
    const d = drafts.get(draftId);
    return d ? cloneDraft(d) : null;
  },

  async saveDraft(input) {
    const now = Date.now();
    const prev = input.draftId ? drafts.get(input.draftId) : undefined;
    const draft: VoiceNoteDraft = {
      id: prev?.id ?? input.draftId ?? nextDraftId(),
      creatorId: getSessionUser()?.id ?? 'unknown',
      status: 'draft',
      title: input.title,
      description: input.description,
      tags: [...input.tags],
      category: input.category,
      artwork: input.artwork,
      audio: input.audio ? { ...input.audio, waveform: [...input.audio.waveform] } : null,
      visibility: input.visibility,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    drafts.set(draft.id, draft);
    return cloneDraft(draft);
  },

  async deleteDraft(draftId) {
    drafts.delete(draftId);
  },

  async publishDraft(draftId) {
    const draft = drafts.get(draftId);
    if (!draft) throw new Error('Draft not found');
    if (!draft.audio) throw new Error('Audio required');
    if (!draft.title.trim()) throw new Error('Title required');

    const form = new FormData();
    form.append('title', draft.title.trim());
    form.append('description', draft.description.trim());
    form.append('visibility', draft.visibility);
    form.append('tags', JSON.stringify(draft.tags));
    form.append('audio', buildDemoWavBlob(draft.audio.duration), 'voice-note.wav');

    const data = await apiRequest<{ voiceNote: BackendVoiceNote }>('/vns', {
      method: 'POST',
      formData: form,
    });

    const note = mapVoiceNote(data.voiceNote);
    cacheNote(note);

    draft.status = 'published';
    draft.publishedNoteId = note.id;
    draft.updatedAt = Date.now();

    return { ...note };
  },

  async getEditableNote(noteId) {
    const me = getSessionUser()?.id;
    if (!me) return null;
    try {
      const data = await apiRequest<{ voiceNote: BackendVoiceNote }>(`/vns/${noteId}`);
      const vn = data.voiceNote;
      if (!vn || (vn.owner?.id ?? vn.ownerId) !== me) return null;
      const note = mapVoiceNote(vn);
      return {
        id: `edit-${note.id}`,
        creatorId: me,
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
          waveform: seededWave(hash(note.id) % 100000, 48),
        },
        visibility: note.visibility ?? 'public',
        createdAt: +new Date(note.releasedAt),
        updatedAt: +new Date(note.releasedAt),
        publishedNoteId: note.id,
      };
    } catch {
      return null;
    }
  },

  async updateNote(noteId, input) {
    const data = await apiRequest<{ voiceNote: BackendVoiceNote }>(`/vns/${noteId}`, {
      method: 'PATCH',
      body: {
        title: input.title.trim(),
        description: input.description.trim(),
        visibility: input.visibility,
        tags: input.tags,
      },
    });
    const note = mapVoiceNote(data.voiceNote);
    cacheNote(note);
    return { ...note };
  },
};

function cloneDraft(d: VoiceNoteDraft): VoiceNoteDraft {
  return {
    ...d,
    tags: [...d.tags],
    audio: d.audio ? { ...d.audio, waveform: [...d.audio.waveform] } : null,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
