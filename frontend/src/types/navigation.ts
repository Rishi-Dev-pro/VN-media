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
