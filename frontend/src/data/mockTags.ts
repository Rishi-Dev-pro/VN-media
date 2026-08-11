import type { Tag } from './types';

/** Trending tags surfaced on the Discover page. */
export const mockTrendingTags: Tag[] = [
  { name: 'ambient', count: 12400 },
  { name: 'night-drive', count: 9800 },
  { name: 'story', count: 8600 },
  { name: 'field-recordings', count: 7400 },
  { name: 'lofi', count: 6900 },
  { name: 'sleep', count: 5200 },
];

/**
 * The searchable tag catalog — every tag a VoiceNote can carry.
 * Counts are demo figures; the catalog drives Search's tag tab
 * and the trending list in the discovery state.
 */
export const mockTagCatalog: Tag[] = [
  { name: 'night', count: 21400 },
  { name: 'story', count: 18600 },
  { name: 'music', count: 17100 },
  { name: 'design', count: 14200 },
  { name: 'journal', count: 12800 },
  { name: 'ambient', count: 12400 },
  { name: 'city', count: 11300 },
  { name: 'field', count: 10400 },
  { name: 'thoughts', count: 9800 },
  { name: 'creative', count: 9100 },
  { name: 'quiet', count: 8700 },
  { name: 'studio', count: 8100 },
  { name: 'morning', count: 7600 },
  { name: 'radio', count: 6900 },
  { name: 'tape', count: 6100 },
  { name: 'sleep', count: 5200 },
];
