import type { Album } from './types';

/** Mock albums — curated collections of VoiceNotes.
 *  Tracks reference the shared VoiceNote catalog, so playing an
 *  album feeds the same global player queue used everywhere. */
export const mockAlbums: Album[] = [
  {
    id: 'alb-night-field',
    title: 'Night Field Notes',
    creatorId: 'crea-luna',
    description:
      'Field recordings from the hours between 2am and dawn — collected across one winter. The city, slowed down.',
    cover: '/images/headphones-dark.jpg',
    voiceNoteIds: [
      'vn-midnight-frequency',
      'vn-warm-static',
      'vn-after-rain',
      'vn-tidal-room',
      'vn-quiet-moments',
    ],
    year: 2026,
    featured: true,
    visibility: 'public',
  },
  {
    id: 'alb-slow-hours',
    title: 'Slow Hours — Vol. 1',
    creatorId: 'crea-elio',
    description:
      'The first collected set from the radio show that never ends. Conversations, confessions and one very slow afternoon.',
    cover: '/images/studio-podcast.jpg',
    voiceNoteIds: ['vn-slow-hours', 'vn-studio-signals', 'vn-ideas-at-2am', 'vn-late-night-signal'],
    year: 2026,
    visibility: 'public',
  },
  {
    id: 'alb-velvet',
    title: 'Velvet Circuits',
    creatorId: 'crea-marcus',
    description: 'Four stories about machines that are trying their best — told in under four minutes each.',
    cover: '/images/matrix-code.jpg',
    voiceNoteIds: ['vn-velvet-circuit', 'vn-paper-satellites', 'vn-glass-horizon', 'vn-static-dreams'],
    year: 2026,
    visibility: 'public',
  },
  {
    id: 'alb-dawn-hours',
    title: 'Dawn Hours',
    creatorId: 'crea-luna',
    description: 'Morning journals and the quiet that comes before the day starts.',
    cover: '/images/headphones-teal.jpg',
    voiceNoteIds: ['vn-morning-journal', 'vn-after-rain', 'vn-quiet-moments'],
    year: 2026,
    visibility: 'public',
  },
  {
    id: 'alb-street-voices',
    title: 'Street Voices',
    creatorId: 'crea-kairo',
    description:
      'Payphones, buskers and the people who talk to strangers — recorded on the street, no scripts.',
    cover: '/images/mic-stage.jpg',
    voiceNoteIds: ['vn-late-night-signal', 'vn-underpass-choir', 'vn-city-stories', 'vn-studio-session'],
    year: 2026,
    visibility: 'public',
  },
  {
    id: 'alb-quiet-machines',
    title: 'Quiet Machines',
    creatorId: 'crea-aria',
    description:
      'Synthesized light for the last train home. Pads, pulses and the demos that became records.',
    cover: '/images/neon-headphones.jpg',
    voiceNoteIds: ['vn-neon-bloom', 'vn-tidal-room', 'vn-behind-the-song', 'vn-glass-horizon', 'vn-static-dreams'],
    year: 2026,
    visibility: 'public',
  },
  {
    id: 'alb-city-after-dark',
    title: 'City After Dark',
    creatorId: 'crea-nocturne',
    description:
      'Empty stadiums, airport lounges, and the city after rain — quiet places measured in minutes.',
    cover: '/images/concert-lights.jpg',
    voiceNoteIds: ['vn-quiet-moments', 'vn-midnight-frequency', 'vn-ideas-at-2am'],
    year: 2026,
    visibility: 'public',
  },
  {
    id: 'alb-drive-tapes',
    title: 'Drive Tapes',
    creatorId: 'crea-serein',
    description:
      'Night drive music: tape loops, distant voices, blurred streetlights. Made for one passenger.',
    cover: '/images/headphones-teal.jpg',
    voiceNoteIds: ['vn-studio-session', 'vn-travel-notes', 'vn-warm-static', 'vn-neon-bloom'],
    year: 2026,
    visibility: 'public',
  },
  {
    id: 'alb-green-room',
    title: 'Green Room Notes',
    creatorId: 'crea-ivy',
    description:
      'Rain, rust, tape hiss and things growing. Botanical field notes recorded in stereo.',
    cover: '/images/mountain-peak.jpg',
    voiceNoteIds: ['vn-travel-notes', 'vn-after-rain', 'vn-morning-journal'],
    year: 2026,
    visibility: 'public',
  },
];

export const albumsById: Record<string, Album> = Object.fromEntries(
  mockAlbums.map((a) => [a.id, a]),
);
