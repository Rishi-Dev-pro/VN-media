import {
  Heart,
  MessageCircle,
  Mic,
  Play,
  Send,
  UserPlus,
} from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { Avatar } from '../../components/common/Avatar';
import { getCreator } from '../../data/mockCreators';
import { formatTime } from '../../utils/format';

/* ---------------- Section 5 — Social ---------------- */

interface FeedItem {
  creatorId: string;
  kind: 'like' | 'follow' | 'comment';
  text: string;
  note: string;
  time: string;
}

const FEED: FeedItem[] = [
  { creatorId: 'crea-luna', kind: 'like', text: 'liked your VoiceNote', note: 'Neon Bloom', time: '2m' },
  { creatorId: 'crea-kairo', kind: 'follow', text: 'started following you', note: '', time: '18m' },
  { creatorId: 'crea-aria', kind: 'comment', text: 'commented on your VoiceNote', note: '“this is unreal”', time: '1h' },
  { creatorId: 'crea-nocturne', kind: 'like', text: 'liked your VoiceNote', note: 'After Rain', time: '3h' },
  { creatorId: 'crea-elio', kind: 'comment', text: 'replied to your comment', note: '“send me the full tape”', time: '5h' },
];

const KIND_ICON: Record<FeedItem['kind'], ComponentType<{ size?: number }>> = {
  like: Heart,
  follow: UserPlus,
  comment: MessageCircle,
};

const STATS = [
  { value: '2.4M', label: 'VoiceNotes shared' },
  { value: '860K', label: 'Creators recording' },
  { value: '18M', label: 'Listens every week' },
];

function SocialFeed() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setIndex((i) => (i + 1) % FEED.length), 3400);
    return () => window.clearInterval(t);
  }, []);

  const item = FEED[index];
  const creator = getCreator(item.creatorId);
  const Icon = KIND_ICON[item.kind];

  return (
    <section className="land-section" id="social">
      <header className="land-section__head">
        <div>
          <span className="land-section__index micro">04 — Social</span>
          <h2 className="land-section__title">
            LISTEN.
            <br />
            <span className="land-section__ghost">CONNECT. BELONG.</span>
          </h2>
        </div>
        <p className="land-section__sub">
          Likes, comments and follows — the quiet conversation that happens
          around every VoiceNote.
        </p>
      </header>

      <div className="social-layout">
        <div className="social-feed" aria-live="polite">
          <div key={index} className="social-feed__item">
            <Avatar src={creator.avatar} alt={creator.name} size={44} ring />
            <div className="social-feed__body">
              <p className="social-feed__text">
                <strong>@{creator.handle}</strong> {item.text}{' '}
                {item.note && <span className="social-feed__note">{item.note}</span>}
              </p>
              <p className="social-feed__meta">
                <Icon size={13} aria-hidden="true" /> {item.time} ago
              </p>
            </div>
            <span className="social-feed__mark" aria-hidden="true">
              <Icon size={16} />
            </span>
          </div>
          <div className="social-feed__dots" aria-hidden="true">
            {FEED.map((_, i) => (
              <span key={i} className={i === index ? 'is-on' : ''} />
            ))}
          </div>
        </div>

        <div className="social-stats">
          {STATS.map((s) => (
            <div key={s.label} className="social-stat">
              <span className="social-stat__num">{s.value}</span>
              <span className="social-stat__label micro">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Section 6 — Private conversations ---------------- */

interface ChatMessage {
  from: 'them' | 'me';
  text?: string;
  audio?: boolean;
  duration?: number;
  read?: boolean;
}

const CHAT: ChatMessage[] = [
  { from: 'them', text: 'did you record the new one?' },
  { from: 'me', text: 'midnight sessions are back 🌙', read: true },
  { from: 'me', audio: true, duration: 42, read: true },
  { from: 'them', text: 'sending it over — press play at 2am' },
];

const CHAT_WAVE = [30, 44, 58, 70, 62, 48, 36, 52, 66, 74, 60, 44, 30, 42, 56, 68, 58, 44, 32, 22];

function Conversations() {
  const them = getCreator('crea-luna');

  return (
    <section className="land-section" id="messages">
      <header className="land-section__head">
        <div>
          <span className="land-section__index micro">05 — Private</span>
          <h2 className="land-section__title">
            SOME THINGS ARE
            <br />
            <span className="land-section__ghost">BETTER SAID.</span>
          </h2>
        </div>
        <p className="land-section__sub">
          Text, voice messages and read receipts — private conversations that
          feel like real ones.
        </p>
      </header>

      <div className="messages-layout">
        <div className="chat">
          <header className="chat__head">
            <Avatar src={them.avatar} alt={them.name} size={34} />
            <div>
              <span className="chat__name">@{them.handle}</span>
              <span className="chat__status">online now</span>
            </div>
            <span className="chat__head-mark micro" aria-hidden="true">···</span>
          </header>

          <div className="chat__thread">
            {CHAT.map((m, i) => (
              <div key={i} className={`chat__row chat__row--${m.from}`}>
                {m.audio ? (
                  <div className="chat__audio">
                    <span className="chat__audio-play" aria-hidden="true">
                      <Play size={11} fill="currentColor" />
                    </span>
                    <span className="chat__audio-wave" aria-hidden="true">
                      {CHAT_WAVE.map((h, j) => (
                        <span key={j} style={{ height: `${h}%` }} />
                      ))}
                    </span>
                    <span className="chat__audio-dur tabular">
                      {m.duration ? formatTime(m.duration) : '0:00'}
                    </span>
                  </div>
                ) : (
                  <p className="chat__bubble">{m.text}</p>
                )}
                {m.from === 'me' && m.read && (
                  <span className="chat__read" aria-label="Read">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                      <path d="M9.5 16.2l-4.7-4.7 1.4-1.4 3.3 3.3 8.3-8.3 1.4 1.4z" />
                    </svg>
                  </span>
                )}
              </div>
            ))}
            <div className="chat__row chat__row--them">
              <p className="chat__typing">
                {them.name.split(' ')[0]} is typing
                <span aria-hidden="true"><i /><i /><i /></span>
              </p>
            </div>
          </div>

          <div className="chat__input">
            <span className="chat__input-text">Write a message…</span>
            <span className="chat__input-icons" aria-hidden="true">
              <Mic size={16} />
              <Send size={16} />
            </span>
          </div>
        </div>

        <aside className="messages-side">
          <div className="messages-side__card">
            <span className="messages-side__mark micro">Voice message</span>
            <p className="messages-side__copy">
              “Recorded, delivered and kept — the way a real conversation should feel.”
            </p>
            <ul className="messages-side__points">
              <li>Audio messages with waveform preview</li>
              <li>Read receipts and typing indicators</li>
              <li>Everything mocked locally for now</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default function LandingSocial() {
  return (
    <>
      <SocialFeed />
      <Conversations />
    </>
  );
}
