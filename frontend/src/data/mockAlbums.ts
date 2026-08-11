import type { Album } from './types';

/** Mock albums. Consumed by the future Albums pages; kept small for now. */
export const mockAlbums: Album[] = [
  {
    id: 'alb-slow-hours',
    title: 'Slow Hours — Vol. 1',
    creatorId: 'crea-elio',
    description:
      'The first collected set from the radio show that never ends. Nine conversations, one slow afternoon.',
    cover: '/images/studio-podcast.jpg',
    voiceNoteIds: ['vn-slow-hours', 'vn-studio-signals'],
    year: 2026,
  },
  {
    id: 'alb-velvet',
    title: 'Velvet Circuits',
    creatorId: 'crea-marcus',
    description:
      'Four stories about machines that are trying their best.',
    cover: '/images/matrix-code.jpg',
    voiceNoteIds: ['vn-velvet-circuit', 'vn-paper-satellites'],
    year: 2026,
  },
  {
    id: 'alb-night-field',
    title: 'Night Field Notes',
    creatorId: 'crea-luna',
    description:
      'Field recordings from the hours between 2am and dawn — collected across one winter.',
    cover: '/images/headphones-dark.jpg',
    voiceNoteIds: ['vn-midnight-frequency', 'vn-warm-static'],
    year: 2026,
  },
  {
    id: 'alb-dawn-hours',
    title: 'Dawn Hours',
    creatorId: 'crea-luna',
    description:
      'Morning journals and the quiet that comes before the day starts.',
    cover: '/images/headphones-teal.jpg',
    voiceNoteIds: ['vn-morning-journal', 'vn-after-rain'],
    year: 2026,
  },
  {
    id: 'alb-street-voices',
    title: 'Street Voices',
    creatorId: 'crea-kairo',
    description:
      'Payphones, buskers and the people who talk to strangers — recorded on the street.',
    cover: '/images/mic-stage.jpg',
    voiceNoteIds: ['vn-late-night-signal', 'vn-underpass-choir', 'vn-city-stories'],
    year: 2026,
  },
  {
    id: 'alb-quiet-machines',
    title: 'Quiet Machines',
    creatorId: 'crea-aria',
    description:
      'Synthesized light for the last train home. Pads, pulses and the demos that became records.',
    cover: '/images/neon-headphones.jpg',
    voiceNoteIds: ['vn-neon-bloom', 'vn-tidal-room', 'vn-behind-the-song'],
    year: 2026,
  },
];

export const albumsById: Record<string, Album> = Object.fromEntries(
  mockAlbums.map((a) => [a.id, a]),
);
