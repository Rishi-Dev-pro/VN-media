/** Every surface the shell can navigate to.
 *  Only `discover` is fully built for now; the rest render
 *  tasteful placeholders until their pages land. */
export type View =
  | 'home'
  | 'discover'
  | 'create'
  | 'search'
  | 'profile'
  | 'following'
  | 'albums'
  | 'creators'
  | 'library'
  | 'messages'
  | 'notifications';

export interface NavItem {
  id: View;
  label: string;
}

const VIEW_IDS: readonly string[] = [
  'home',
  'discover',
  'create',
  'search',
  'profile',
  'following',
  'albums',
  'creators',
  'library',
  'messages',
  'notifications',
];

/** Map a location pathname to the matching app view. */
export function pathToView(pathname: string): View {
  const seg = pathname.replace(/^\//, '');
  return VIEW_IDS.includes(seg) ? (seg as View) : 'discover';
}
