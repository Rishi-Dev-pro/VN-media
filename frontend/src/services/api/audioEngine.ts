/* ============================================================
   Real-audio engine (Phase 18, API mode).

   Bridges the global PlayerContext to the backend's streaming
   endpoints without an <audio> element ever carrying credentials:

     - PUBLIC notes: the browser plays the stream URL directly,
       so HTTP Range requests (seeking) work natively.
     - PRIVATE notes: the client fetches the authorized stream as a
       blob (Bearer header), object-URLs it, and plays locally —
       the private source is never exposed as a plain URL.

   One element, one active source. Callers (PlayerContext) drive
   play/pause/seek/volume/rate and consume timeupdate/ended/error.
   ============================================================ */

import { apiStream } from './apiClient';
import { getToken } from './session';

interface AudioEngineHandlers {
  onTimeUpdate: (time: number) => void;
  onEnded: () => void;
  onError: (message: string) => void;
}

class AudioEngine {
  private el: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;

  private ensureElement(): HTMLAudioElement {
    if (this.el) return this.el;
    const el = new Audio();
    el.preload = 'auto';
    this.el = el;
    return el;
  }

  /** Load a real stream URL. `privateNote` fetches an authorized blob.
   *  `startAt` (seconds) resumes a saved position after metadata loads.
   *
   *  Public notes play the URL with `crossOrigin='anonymous'` so the media
   *  request is CORS-enabled — the backend's `Cross-Origin-Resource-Policy:
   *  same-origin` header blocks no-cors cross-origin loads, while range
   *  requests keep working natively on the CORS-enabled element.
   *  Private notes never expose a plain URL: the authorized stream is
   *  fetched as a blob (Bearer header) and object-URL'd locally. */
  async load(
    url: string,
    privateNote: boolean,
    handlers: AudioEngineHandlers,
    startAt = 0,
  ): Promise<void> {
    const el = this.ensureElement();
    this.release();

    if (!privateNote) {
      el.crossOrigin = 'anonymous';
      el.src = url;
    } else {
      const token = getToken();
      if (!token) {
        handlers.onError('Authentication required');
        return;
      }
      const response = await apiStream(url, { auth: true });
      const blob = await response.blob();
      this.objectUrl = URL.createObjectURL(blob);
      el.src = this.objectUrl;
    }

    el.onloadedmetadata = () => {
      if (startAt > 0 && Number.isFinite(el.duration) && el.duration > 0) {
        el.currentTime = Math.min(startAt, el.duration);
      }
      handlers.onTimeUpdate(el.currentTime);
    };
    el.ontimeupdate = () => {
      handlers.onTimeUpdate(el.currentTime);
    };
    el.onended = () => {
      handlers.onEnded();
    };
    el.onerror = () => {
      handlers.onError('Playback signal lost');
    };
  }

  play(): void {
    void this.ensureElement().play().catch(() => undefined);
  }

  pause(): void {
    this.ensureElement().pause();
  }

  seekTo(seconds: number): void {
    const el = this.ensureElement();
    if (Number.isFinite(el.duration) && el.duration > 0) {
      el.currentTime = Math.min(Math.max(0, seconds), el.duration);
    }
  }

  setVolume(v: number): void {
    this.ensureElement().volume = Math.min(Math.max(0, v), 1);
  }

  setRate(r: number): void {
    this.ensureElement().playbackRate = r;
  }

  /** Clear listeners + the object URL. Does not stop playback. */
  release(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    if (this.el) {
      this.el.onloadedmetadata = null;
      this.el.ontimeupdate = null;
      this.el.onended = null;
      this.el.onerror = null;
    }
  }

  /** Hard stop: release and pause. */
  dispose(): void {
    this.release();
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute('src');
      this.el.load();
    }
  }
}

/** Singleton engine — one <audio> element for the whole app. */
export const audioEngine = new AudioEngine();
