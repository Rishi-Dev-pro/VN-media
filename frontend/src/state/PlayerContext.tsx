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
import { ambientAudio } from '../utils/ambientAudio';

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
  repeat: RepeatMode;
  likedIds: Set<string>;
}

interface PlayerApi {
  /** Start playing (optionally inside a queue) */
  play: (note: VoiceNote, queue?: VoiceNote[]) => void;
  /** Set the current track without starting playback */
  select: (note: VoiceNote, queue?: VoiceNote[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  setSpeed: (s: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
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
  repeat: 'off',
  likedIds: new Set(['vn-midnight-frequency', 'vn-after-rain']),
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>(initialState);

  // Keep a live mirror for the rAF loop without stale closures.
  const stateRef = useRef(state);
  stateRef.current = state;

  /* ---------- ambient audio sync ---------- */
  useEffect(() => {
    if (state.isPlaying) ambientAudio.play(state.volume);
    else ambientAudio.pause();
  }, [state.isPlaying, state.current, state.volume]);

  useEffect(() => {
    ambientAudio.setVolume(state.volume);
  }, [state.volume]);

  /* ---------- playback clock ---------- */
  useEffect(() => {
    if (!state.isPlaying || !state.current) return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const s = stateRef.current;
      if (!s.isPlaying || !s.current) return;
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;

      let nextElapsed = s.elapsed + dt * s.speed;
      let nextState: Partial<PlayerState> = { elapsed: nextElapsed };

      if (nextElapsed >= s.current.duration) {
        if (s.repeat === 'one') {
          nextState = { elapsed: 0 };
        } else if (s.queue.length > 0) {
          const count = s.queue.length;
          let idx = s.queueIndex;
          if (s.shuffle) {
            idx = Math.floor(Math.random() * count);
          } else {
            idx = (idx + 1) % count;
          }
          nextState = {
            current: s.queue[idx],
            queueIndex: idx,
            elapsed: 0,
            isPlaying: s.repeat === 'off' && idx === 0 && s.queueIndex === count - 1 ? false : true,
          };
        } else {
          nextState = { elapsed: s.current.duration, isPlaying: false };
        }
      }

      setState((prev) => ({ ...prev, ...nextState }));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isPlaying, state.current?.id]);

  /* ---------- actions ---------- */
  const play = useCallback((note: VoiceNote, queue?: VoiceNote[]) => {
    setState((prev) => {
      const q = queue && queue.length > 0 ? queue : [note];
      const idx = q.findIndex((n) => n.id === note.id);
      return {
        ...prev,
        current: note,
        queue: q,
        queueIndex: idx >= 0 ? idx : 0,
        elapsed: prev.current?.id === note.id ? prev.elapsed : 0,
        isPlaying: true,
      };
    });
  }, []);

  const select = useCallback((note: VoiceNote, queue?: VoiceNote[]) => {
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
      };
    });
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => (prev.current ? { ...prev, isPlaying: !prev.isPlaying } : prev));
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    setState((prev) => {
      if (!prev.current || prev.queue.length === 0) return prev;
      let idx = prev.queueIndex;
      if (prev.shuffle) {
        idx = Math.floor(Math.random() * prev.queue.length);
      } else {
        idx = (idx + dir + prev.queue.length) % prev.queue.length;
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

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  const seek = useCallback((seconds: number) => {
    setState((prev) => {
      if (!prev.current) return prev;
      const clamped = Math.min(Math.max(0, seconds), prev.current.duration);
      return { ...prev, elapsed: clamped };
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    setState((prev) => ({ ...prev, volume: Math.min(Math.max(0, v), 1) }));
  }, []);

  const setSpeed = useCallback((s: number) => {
    setState((prev) => ({ ...prev, speed: s }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setState((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const cycleRepeat = useCallback(() => {
    setState((prev) => {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      const i = order.indexOf(prev.repeat);
      return { ...prev, repeat: order[(i + 1) % order.length] };
    });
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
