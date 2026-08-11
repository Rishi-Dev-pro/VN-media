/**
 * A tiny self-contained "now playing" ambience generator.
 *
 * VN-Media has no audio files or backend yet, but playback should
 * still feel alive: this synthesizes a soft, evolving pad through
 * the Web Audio API. Every call is guarded — if anything fails the
 * player simply runs silently.
 */

class AmbientAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.8;

  private ensure(): boolean {
    if (this.ctx) return true;
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();

      const ctx = this.ctx;
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      this.master = master;

      // Two detuned oscillators through a soft lowpass.
      const oscA = ctx.createOscillator();
      oscA.type = 'triangle';
      oscA.frequency.value = 110;

      const oscB = ctx.createOscillator();
      oscB.type = 'sine';
      oscB.frequency.value = 164.81;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 640;
      filter.Q.value = 0.5;

      const gain = ctx.createGain();
      gain.gain.value = 0.55;

      // Slow breathing LFO on the pad level.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.12;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.16;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      oscA.start();
      oscB.start();
      lfo.start();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  play(volume = this.volume): void {
    this.volume = volume;
    if (!this.ensure() || !this.ctx || !this.master) return;
    this.ctx.resume().catch(() => undefined);
    this.master.gain.setTargetAtTime(
      0.5 * Math.min(volume, 1) * 0.3,
      this.ctx.currentTime,
      0.5,
    );
  }

  pause(): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.18);
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (!this.ctx || !this.master || this.ctx.state !== 'running') return;
    this.master.gain.setTargetAtTime(
      0.5 * Math.min(volume, 1) * 0.3,
      this.ctx.currentTime,
      0.12,
    );
  }
}

export const ambientAudio = new AmbientAudio();
