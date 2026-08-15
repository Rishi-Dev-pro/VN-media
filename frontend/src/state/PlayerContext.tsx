import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { VoiceNote } from '../data/types';
import { voiceNotesById } from '../data/mockVoiceNotes';
import { ambientAudio } from '../utils/ambientAudio';
import { hashString, seededShuffle } from '../utils/seeded';
import { isApiMode } from '../services/api/apiConfig';
import { useSession } from './SessionContext';
import { audioEngine } from '../services/api/audioEngine';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  current: VoiceNote | null;
  queue: VoiceNote[];
  queueIndex: number;
  isPlaying: boolean;
  elapsed: number;
  volume: number;
  speed: number;
  shuffle: boolean;
  /** deterministic shuffled index order — null when shuffle is off */
  shuffleOrder: number[] | null;
  repeat: RepeatMode;
  likedIds: Set<string>;
  /** deterministic demo failure — PLAYBACK SIGNAL LOST */
  playbackError: boolean;
  /** optional origin of the current queue (e.g. an album title) */
  queueLabel: string | null;
}

interface PlayerApi {
  /** Start playing (optionally inside a queue). `startAt` resumes from a
   *  saved position; `label` names the queue's origin for the UI. */
  play: (note: VoiceNote, queue?: VoiceNote[], startAt?: number, label?: string) => void;
  /** Set the current track without starting playback */
  select: (note: VoiceNote, queue?: VoiceNote[], label?: string) => void;
  toggle: () => void;
  next: () => void;
  /** Restarts the current note if it's meaningful in; otherwise steps back. */
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  setSpeed: (s: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  /** Append an upcoming VoiceNote (dedupes by id). */
  addToQueue: (note: VoiceNote) => void;
  /** Insert right after the current item (dedupes; moves existing copy). */
  playNext: (note: VoiceNote) => void;
  /** Remove an upcoming VoiceNote (never the current one). */
  removeFromQueue: (noteId: string) => void;
  /** Keep the current note, empty the upcoming list. */
  clearQueue: () => void;
  /** Reorder upcoming items by full-queue indices. */
  moveInQueue: (from: number, to: number) => void;
  /** Recover from the deterministic playback failure demo. */
  retryPlayback: () => void;
  toggleLike: (id: string) => void;
  isLiked: (id: string) => boolean;
}

const PlayerContext = createContext<PlayerState & PlayerApi | null>(null);

const initialState: PlayerState = {
  current: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  elapsed: 0,
  volume: 0.8,
  speed: 1,
  shuffle: false,
  shuffleOrder: null,
  repeat: 'off',
  likedIds: new Set(['vn-midnight-frequency', 'vn-after-rain']),
  playbackError: false,
  queueLabel: null,
};

/* ---------- session persistence ----------
 * Lightweight, deterministic playback persistence: the queue, current
 * VoiceNote, position, and player modes survive a hard refresh within the
 * same tab session. Best-effort — storage failures silently fall back to
 * the initial state. Never persisted to the backend. */
const STORAGE_KEY = 'vn.player.session.v1';

interface PersistedPlayer {
  currentId: string | null;
  queueIds: string[];
  queueIndex: number;
  elapsed: number;
  volume: number;
  speed: number;
  shuffle: boolean;
  repeat: RepeatMode;
  queueLabel: string | null;
  likedIds: string[];
}

function loadPersisted(): PersistedPlayer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPlayer;
    if (!Array.isArray(parsed.queueIds) || typeof parsed.currentId !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Resolve a saved session into real VoiceNotes; fall back to defaults.
 *  API mode never hydrates from the local session — resolved ids could
 *  reference mock catalog entries, and the backend is the only source. */
function hydrateInitialState(): PlayerState {
  if (isApiMode) return initialState;
  const saved = loadPersisted();
  if (!saved) return initialState;
  const queue = saved.queueIds
    .map((id) => voiceNotesById[id])
    .filter((n): n is VoiceNote => Boolean(n));
  const current = queue[saved.queueIndex] ?? null;
  if (!current) return initialState;
  return {
    ...initialState,
    current,
    queue,
    queueIndex: saved.queueIndex,
    elapsed: Math.min(Math.max(0, saved.elapsed), current.duration),
    volume: Math.min(Math.max(0, saved.volume), 1),
    speed: saved.speed > 0 ? saved.speed : 1,
    shuffle: Boolean(saved.shuffle),
    repeat: saved.repeat ?? 'off',
    queueLabel: saved.queueLabel ?? null,
    likedIds: new Set(saved.likedIds?.length ? saved.likedIds : initialState.likedIds),
  };
}

/* ---------- deterministic demo switch ---------- */
let errorArmed = false;
/** `?demo=player-error` fails the FIRST playback action; retry recovers
 *  without a page reload (deterministic, reproducible). */
function failDemo(): boolean {
  if (typeof window === 'undefined') return false;
  const isDemo = new URLSearchParams(window.location.search).get('demo') === 'player-error';
  if (!isDemo || errorArmed) return false;
  errorArmed = true;
  return true;
}

/** salt so re-enabling shuffle produces a fresh (still deterministic) order */
let shuffleSalt = 0;

/** A shuffled index order anchored with the current item first. */
function buildShuffleOrder(queueLen: number, currentIndex: number): number[] {
  shuffleSalt += 1;
  const order = seededShuffle(
    Array.from({ length: queueLen }, (_, i) => i),
    hashString(`${queueLen}:${currentIndex}:${shuffleSalt}`),
  );
  const cur = order.indexOf(currentIndex);
  if (cur > 0) {
    order.splice(cur, 1);
    order.unshift(currentIndex);
  }
  return order;
}

/** Re-anchor the shuffle order after any queue mutation. */
function withShuffle(
  prev: PlayerState,
  queue: VoiceNote[],
  queueIndex: number,
): PlayerState {
  if (!prev.shuffle) return { ...prev, queue, queueIndex };
  return {
    ...prev,
    queue,
    queueIndex,
    shuffleOrder: buildShuffleOrder(queue.length, queueIndex),
  };
}

/** True when the current note has a real backend media source. */
function isRealMedia(s: PlayerState): boolean {
  return isApiMode && Boolean(s.current?.audioUrl);
}

/** End-of-track resolution: repeat / shuffle / queue / stop. Shared by the
 *  simulated clock and the real-audio `ended` handler. */
function advanceOnEnd(s: PlayerState): Partial<PlayerState> {
  if (!s.current) return { isPlaying: false };
  if (s.repeat === 'one') return { elapsed: 0 };
  if (s.queue.length > 0) {
    const count = s.queue.length;
    if (s.shuffle && s.shuffleOrder && s.shuffleOrder.length === count) {
      const pos = s.shuffleOrder.indexOf(s.queueIndex);
      const isLast = pos === count - 1;
      const idx = s.shuffleOrder[(pos + 1) % count];
      return {
        current: s.queue[idx],
        queueIndex: idx,
        elapsed: 0,
        isPlaying: !(s.repeat === 'off' && isLast),
      };
    }
    const idx = (s.queueIndex + 1) % count;
    const isLast = s.repeat === 'off' && idx === 0 && s.queueIndex === count - 1;
    return {
      current: s.queue[idx],
      queueIndex: idx,
      elapsed: 0,
      isPlaying: !isLast,
    };
  }
  return { elapsed: s.current.duration, isPlaying: false };
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>(hydrateInitialState);
  const sessionStatus = useSession();

  // Session cleared (logout / expired): drop the previous account's in-memory
  // playback state so it can never re-record or re-surface for the next user.
  const lastSession = useRef<ReturnType<typeof useSession>>(sessionStatus);
  useEffect(() => {
    const prev = lastSession.current;
    lastSession.current = sessionStatus;
    if (prev === 'authenticated' && sessionStatus !== 'authenticated') {
      setState((cur) => (cur.current || cur.queue.length > 0 ? { ...initialState, likedIds: cur.likedIds } : cur));
    }
  }, [sessionStatus]);

  // Keep a live mirror for the rAF loop without stale closures.
  const stateRef = useRef(state);
  stateRef.current = state;

  /* ---------- ambient audio sync (mock hum only — real media plays itself) ---------- */
  useEffect(() => {
    const real = isRealMedia(state);
    if (state.isPlaying && !state.playbackError && !real) ambientAudio.play(state.volume);
    else ambientAudio.pause();
  }, [state.isPlaying, state.current, state.volume, state.playbackError]);

  useEffect(() => {
    ambientAudio.setVolume(state.volume);
  }, [state.volume]);

  /* ---------- simulated playback clock (real media drives itself) ---------- */
  useEffect(() => {
    if (!state.isPlaying || !state.current || state.playbackError) return;
    if (isRealMedia(state)) return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const s = stateRef.current;
      if (!s.isPlaying || !s.current || s.playbackError || isRealMedia(s)) return;
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;

      const nextElapsed = s.elapsed + dt * s.speed;
      const nextState: Partial<PlayerState> =
        nextElapsed >= s.current.duration ? advanceOnEnd(s) : { elapsed: nextElapsed };

      setState((prev) => ({ ...prev, ...nextState }));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isPlaying, state.current?.id, state.playbackError]);

  /* ---------- real media (Phase 18): load + drive the shared <audio> ---------- */
  useEffect(() => {
    const s = stateRef.current;
    if (!isRealMedia(s) || !s.current) return;
    const note = s.current;
    const startAt = s.elapsed > 0 ? s.elapsed : 0;
    let disposed = false;

    void audioEngine
      .load(note.audioUrl!, note.visibility === 'private', {
        onTimeUpdate: (time) => {
          if (disposed) return;
          const cur = stateRef.current;
          if (!cur.current || cur.current.id !== note.id) return;
          // clamp to the note's known duration so the UI never runs away
          setState((prev) => ({ ...prev, elapsed: Math.min(time, prev.current?.duration ?? time) }));
        },
        onEnded: () => {
          if (disposed) return;
          setState((prev) => ({ ...prev, ...advanceOnEnd(prev) }));
        },
        onError: () => {
          if (disposed) return;
          setState((prev) =>
            prev.current?.id === note.id
              ? { ...prev, isPlaying: false, playbackError: true }
              : prev,
          );
        },
      }, startAt)
      .then(() => {
        if (disposed) return;
        audioEngine.setVolume(stateRef.current.volume);
        audioEngine.setRate(stateRef.current.speed);
        if (stateRef.current.isPlaying) audioEngine.play();
      })
      .catch(() => {
        if (disposed) return;
        setState((prev) =>
          prev.current?.id === note.id ? { ...prev, playbackError: true, isPlaying: false } : prev,
        );
      });

    return () => {
      disposed = true;
      audioEngine.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.current?.id]);

  // play / pause the real element
  useEffect(() => {
    if (!isRealMedia(state)) return;
    if (state.isPlaying && !state.playbackError) audioEngine.play();
    else audioEngine.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isPlaying, state.playbackError, state.current?.id]);

  // volume + rate flow straight through to the element
  useEffect(() => {
    if (!isRealMedia(state)) return;
    audioEngine.setVolume(state.volume);
  }, [state.volume, state.current?.id]);

  useEffect(() => {
    if (!isRealMedia(state)) return;
    audioEngine.setRate(state.speed);
  }, [state.speed, state.current?.id]);

  /* ---------- persistence ---------- */
  const saveSession = useCallback(() => {
    const s = stateRef.current;
    if (!s.current) return;
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentId: s.current.id,
          queueIds: s.queue.map((n) => n.id),
          queueIndex: s.queueIndex,
          elapsed: s.elapsed,
          volume: s.volume,
          speed: s.speed,
          shuffle: s.shuffle,
          repeat: s.repeat,
          queueLabel: s.queueLabel,
          likedIds: [...s.likedIds],
        } satisfies PersistedPlayer),
      );
    } catch {
      // storage unavailable — persistence is best-effort
    }
  }, []);

  // structural changes (track, queue, modes) persist immediately
  useEffect(() => {
    saveSession();
  }, [
    state.current?.id,
    state.queue,
    state.queueIndex,
    state.volume,
    state.speed,
    state.shuffle,
    state.repeat,
    state.queueLabel,
    state.likedIds,
    saveSession,
  ]);

  // position persists on pause and (throttled) while playing
  const lastPosSave = useRef(0);
  useEffect(() => {
    const s = stateRef.current;
    if (!s.current) return;
    const now = Date.now();
    if (!s.isPlaying || now - lastPosSave.current >= 1500) {
      lastPosSave.current = now;
      saveSession();
    }
  }, [state.elapsed, state.isPlaying, saveSession]);

  /* ---------- actions ---------- */
  const play = useCallback((note: VoiceNote, queue?: VoiceNote[], startAt?: number, label?: string) => {
    setState((prev) => {
      if (failDemo()) return { ...prev, isPlaying: false, playbackError: true };
      const q = queue && queue.length > 0 ? queue : [note];
      const idx = q.findIndex((n) => n.id === note.id);
      return {
        ...prev,
        current: note,
        queue: q,
        queueIndex: idx >= 0 ? idx : 0,
        elapsed:
          startAt !== undefined
            ? startAt
            : prev.current?.id === note.id
              ? prev.elapsed
              : 0,
        isPlaying: true,
        playbackError: false,
        queueLabel: label ?? null,
      };
    });
  }, []);

  const select = useCallback((note: VoiceNote, queue?: VoiceNote[], label?: string) => {
    setState((prev) => {
      const q = queue && queue.length > 0 ? queue : [note];
      const idx = q.findIndex((n) => n.id === note.id);
      return {
        ...prev,
        current: note,
        queue: q,
        queueIndex: idx >= 0 ? idx : 0,
        elapsed: prev.current?.id === note.id ? prev.elapsed : 0,
        isPlaying: false,
        playbackError: false,
        queueLabel: label ?? null,
      };
    });
  }, []);

  const toggle = useCallback(() => {
    setState((prev) =>
      prev.current ? { ...prev, isPlaying: !prev.isPlaying } : prev,
    );
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    setState((prev) => {
      if (!prev.current || prev.queue.length === 0) return prev;
      if (failDemo()) return { ...prev, isPlaying: false, playbackError: true };
      const count = prev.queue.length;
      let idx: number;
      if (prev.shuffle && prev.shuffleOrder && prev.shuffleOrder.length === count) {
        const pos = prev.shuffleOrder.indexOf(prev.queueIndex);
        idx = prev.shuffleOrder[(pos + dir + count) % count];
      } else {
        idx = (prev.queueIndex + dir + count) % count;
      }
      const note = prev.queue[idx];
      return {
        ...prev,
        current: note,
        queueIndex: idx,
        elapsed: 0,
        isPlaying: true,
      };
    });
  }, []);

  const seek = useCallback((seconds: number) => {
    setState((prev) => {
      if (!prev.current) return prev;
      const clamped = Math.min(Math.max(0, seconds), prev.current.duration);
      if (isRealMedia(prev)) audioEngine.seekTo(clamped);
      return { ...prev, elapsed: clamped };
    });
  }, []);

  const next = useCallback(() => step(1), [step]);

  const prev = useCallback(() => {
    // typical listening behavior: restart the current note if we're
    // meaningful in; otherwise step back to the previous item
    if (stateRef.current.elapsed > 3) {
      seek(0);
      return;
    }
    step(-1);
  }, [step, seek]);

  const setVolume = useCallback((v: number) => {
    setState((prev) => ({ ...prev, volume: Math.min(Math.max(0, v), 1) }));
  }, []);

  const setSpeed = useCallback((s: number) => {
    setState((prev) => ({ ...prev, speed: s }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setState((prev) => {
      if (prev.shuffle) {
        return { ...prev, shuffle: false, shuffleOrder: null };
      }
      return {
        ...prev,
        shuffle: true,
        shuffleOrder: buildShuffleOrder(prev.queue.length, prev.queueIndex),
      };
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setState((prev) => {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      const i = order.indexOf(prev.repeat);
      return { ...prev, repeat: order[(i + 1) % order.length] };
    });
  }, []);

  /* ---------- queue ---------- */

  const addToQueue = useCallback((note: VoiceNote) => {
    setState((prev) => {
      if (!prev.current) {
        // nothing playing — starting the note is the sensible outcome
        return {
          ...prev,
          current: note,
          queue: [note],
          queueIndex: 0,
          elapsed: 0,
          isPlaying: true,
          playbackError: false,
          queueLabel: null,
        };
      }
      if (prev.queue.some((n) => n.id === note.id)) return prev; // dedupe
      return { ...prev, queue: [...prev.queue, note] };
    });
  }, []);

  const playNext = useCallback((note: VoiceNote) => {
    setState((prev) => {
      if (!prev.current) return prev;
      if (prev.current.id === note.id) return prev; // already current
      const queue = prev.queue.filter((n) => n.id !== note.id);
      const idx = queue.findIndex((n) => n.id === prev.current!.id);
      queue.splice(idx + 1, 0, note);
      return withShuffle(prev, queue, idx);
    });
  }, []);

  const removeFromQueue = useCallback((noteId: string) => {
    setState((prev) => {
      if (!prev.current || prev.current.id === noteId) return prev; // never remove current
      const i = prev.queue.findIndex((n) => n.id === noteId);
      if (i < 0) return prev;
      const queue = prev.queue.filter((n) => n.id !== noteId);
      const queueIndex = i < prev.queueIndex ? prev.queueIndex - 1 : prev.queueIndex;
      return withShuffle(prev, queue, queueIndex);
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState((prev) => {
      if (!prev.current) return prev;
      return withShuffle(prev, [prev.current], 0);
    });
  }, []);

  const moveInQueue = useCallback((from: number, to: number) => {
    setState((prev) => {
      if (from === to || !prev.current) return prev;
      const lo = prev.queueIndex + 1; // upcoming only
      if (from < lo || to < lo || from >= prev.queue.length || to >= prev.queue.length) {
        return prev;
      }
      const queue = [...prev.queue];
      const [item] = queue.splice(from, 1);
      queue.splice(to, 0, item);
      return withShuffle(prev, queue, prev.queueIndex);
    });
  }, []);

  const retryPlayback = useCallback(() => {
    setState((prev) =>
      prev.current
        ? { ...prev, playbackError: false, isPlaying: true, elapsed: 0 }
        : prev,
    );
  }, []);

  const toggleLike = useCallback((id: string) => {
    setState((prev) => {
      const next = new Set(prev.likedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, likedIds: next };
    });
  }, []);

  const isLiked = useCallback(
    (id: string) => state.likedIds.has(id),
    [state.likedIds],
  );

  const value = useMemo<PlayerState & PlayerApi>(
    () => ({
      ...state,
      play,
      select,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      setSpeed,
      toggleShuffle,
      cycleRepeat,
      addToQueue,
      playNext,
      removeFromQueue,
      clearQueue,
      moveInQueue,
      retryPlayback,
      toggleLike,
      isLiked,
    }),
    [
      state,
      play,
      select,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      setSpeed,
      toggleShuffle,
      cycleRepeat,
      addToQueue,
      playNext,
      removeFromQueue,
      clearQueue,
      moveInQueue,
      retryPlayback,
      toggleLike,
      isLiked,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerState & PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}
