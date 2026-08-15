/* ============================================================
   Deterministic WAV builder (Phase 18).

   The Creator Studio and message composer work without a real
   microphone (frontend mock), but API mode needs a real audio file
   to exercise the backend's upload/validation/streaming pipeline.
   This builds a valid PCM WAV of the requested duration with a
   deterministic low sine tone — same input always produces the
   same bytes. Sizes stay well under the backend's 10MB limit at
   8kHz mono 16-bit.
   ============================================================ */

const SAMPLE_RATE = 8000;

/** Build a mono 16-bit PCM WAV Blob of the given duration (seconds). */
export function buildDemoWavBlob(durationSeconds: number): Blob {
  const duration = Math.max(1, Math.round(durationSeconds));
  const numSamples = duration * SAMPLE_RATE;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');

  // fmt chunk (PCM)
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk — deterministic tone (220Hz carrier with a slow LFO)
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.22 * t);
    const sample = 0.14 * envelope * Math.sin(2 * Math.PI * 220 * t);
    view.setInt16(44 + i * 2, clamp16(sample), true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function clamp16(v: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
}
