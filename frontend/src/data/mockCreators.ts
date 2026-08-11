import type { Creator } from './types';

/** Mock creator profiles. Avatars are local assets. */
export const mockCreators: Creator[] = [
  {
    id: 'crea-luna',
    handle: 'luna.wav',
    name: 'Luna Maré',
    avatar: '/images/portrait-1.jpg',
    bio: 'Field recordings from the hours between 2am and dawn. Ambient textures for people who sleep with the lights on.',
    followers: 48200,
    following: 214,
    tint: '#9fd4e8',
  },
  {
    id: 'crea-aria',
    handle: 'aria.night',
    name: 'Aria Nocturne',
    avatar: '/images/portrait-2.jpg',
    bio: 'Making slow music for fast cities. Neon ambience, velvet pads, city-lit textures.',
    followers: 96100,
    following: 88,
    tint: '#b3a6f2',
  },
  {
    id: 'crea-kairo',
    handle: 'kairo.beats',
    name: 'Kairo Osei',
    avatar: '/images/portrait-3.jpg',
    bio: 'Late-night conversations recorded on tape. Real voices, real rooms, no scripts.',
    followers: 31500,
    following: 402,
    tint: '#7ee2b8',
  },
  {
    id: 'crea-nocturne',
    handle: 'nocturne__',
    name: 'Nocturne Vale',
    avatar: '/images/portrait-4.jpg',
    bio: 'Field recordings from empty stadiums, airport lounges, and the city after rain.',
    followers: 124000,
    following: 156,
    tint: '#f5a97f',
  },
  {
    id: 'crea-marcus',
    handle: 'marcus.void',
    name: 'Marcus Void',
    avatar: '/images/portrait-5.jpg',
    bio: 'Short stories told in 4 minutes or less. Fiction for headphones.',
    followers: 20700,
    following: 67,
    tint: '#8ecae6',
  },
  {
    id: 'crea-ivy',
    handle: 'ivy.static',
    name: 'Ivy Static',
    avatar: '/images/portrait-6.jpg',
    bio: 'Rain, rust, tape hiss and things growing. Botanical field notes in stereo.',
    followers: 58900,
    following: 233,
    tint: '#a3d9a5',
  },
  {
    id: 'crea-elio',
    handle: 'elio.fm',
    name: 'Elio Ferreira',
    avatar: '/images/portrait-7.jpg',
    bio: 'A radio show that never ends. Conversations, confessions and slow hours.',
    followers: 153000,
    following: 112,
    tint: '#ffd6a5',
  },
  {
    id: 'crea-serein',
    handle: 'serein.studio',
    name: 'Serein',
    avatar: '/images/portrait-8.jpg',
    bio: 'Night drive music. Tape loops, distant voices, blurred streetlights.',
    followers: 27400,
    following: 91,
    tint: '#c4b5fd',
  },
];

export const creatorsById: Record<string, Creator> = Object.fromEntries(
  mockCreators.map((c) => [c.id, c]),
);

export function getCreator(id: string): Creator {
  return creatorsById[id] ?? mockCreators[0];
}

export function getCreatorByHandle(handle: string): Creator | undefined {
  return mockCreators.find((c) => c.handle === handle);
}
