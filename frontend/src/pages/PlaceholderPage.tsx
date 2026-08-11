import {
  Bell,
  Compass,
  Disc3,
  Home,
  Library,
  MessageCircle,
  Mic2,
  PlusCircle,
  Search,
  User,
  Users,
} from 'lucide-react';
import type { View } from '../types/navigation';
import './PlaceholderPage.css';

const META: Record<View, { icon: typeof Home; label: string; blurb: string }> = {
  home: { icon: Home, label: 'Home', blurb: 'A personal welcome back — your day in sound.' },
  discover: { icon: Compass, label: 'Discover', blurb: 'Find your next VoiceNote.' },
  following: { icon: Users, label: 'Following', blurb: 'Fresh VoiceNotes from the creators you follow.' },
  albums: { icon: Disc3, label: 'Albums', blurb: 'Collections of VoiceNotes, gathered into one place.' },
  creators: { icon: Mic2, label: 'Creators', blurb: 'The voices and faces behind VN-Media.' },
  search: { icon: Search, label: 'Search', blurb: 'Find VoiceNotes, creators, albums and tags.' },
  library: { icon: Library, label: 'Library', blurb: 'Your saved, downloaded and liked VoiceNotes.' },
  messages: { icon: MessageCircle, label: 'Messages', blurb: 'Private conversations and voice messages.' },
  notifications: { icon: Bell, label: 'Notifications', blurb: 'Followers, likes and comments on your VoiceNotes.' },
  profile: { icon: User, label: 'Profile', blurb: 'Your identity, VoiceNotes and stats.' },
  create: { icon: PlusCircle, label: 'Create', blurb: 'Record and publish a new VoiceNote.' },
};

interface PlaceholderPageProps {
  view: View;
}

export default function PlaceholderPage({ view }: PlaceholderPageProps) {
  const meta = META[view];
  const Icon = meta.icon;

  return (
    <div className="placeholder">
      <span className="placeholder__orb" aria-hidden="true">
        <Icon size={30} strokeWidth={1.5} />
      </span>
      <h1 className="placeholder__title">{meta.label}</h1>
      <p className="placeholder__blurb">{meta.blurb}</p>
      <span className="placeholder__tag micro">Coming in the next build</span>
    </div>
  );
}
