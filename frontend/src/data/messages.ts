import { DEMO_NOW } from './mockFollowing';
import { seededWave } from '../utils/waveform';

/* ============================================================
   Private conversations (mock).

   Deterministic, cinematic 1-to-1 threads between the demo
   listener (@rishi) and existing VN-Media creators. All
   timestamps are anchored to DEMO_NOW so the UI reads as
   stable relative times. Audio waveforms are generated from
   a seeded PRNG — no external audio files.
   ============================================================ */

export type MessageKind = 'text' | 'audio';
export type MessageStatus = 'sent' | 'delivered' | 'seen';

export interface MockAudio {
  /** duration in seconds */
  duration: number;
  /** bar heights 0..1 for the CSS waveform (deterministic) */
  waveform: number[];
}

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  kind: MessageKind;
  /** text content (never present on deleted messages) */
  text?: string;
  audio?: MockAudio;
  /** epoch ms */
  sentAt: number;
  status: MessageStatus;
  deleted: boolean;
}

export interface Conversation {
  id: string;
  /** the other party — an existing creator id */
  creatorId: string;
  unread: number;
  muted?: boolean;
  /** deterministic reply fired once per session after the user sends */
  scriptedReply?: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;


/* ---------------- conversations ---------------- */

export const conversations: Conversation[] = [
  {
    id: 'conv-luna',
    creatorId: 'crea-luna',
    unread: 2,
    scriptedReply: 'Ha — knew you’d hear it. Wait for the last thirty seconds.',
  },
  {
    id: 'conv-elio',
    creatorId: 'crea-elio',
    unread: 0,
    scriptedReply: 'Right? Listen from 01:40 — the room tone flips completely.',
  },
  {
    id: 'conv-aria',
    creatorId: 'crea-aria',
    unread: 0,
  },
  {
    id: 'conv-kairo',
    creatorId: 'crea-kairo',
    unread: 0,
  },
  {
    id: 'conv-mira',
    creatorId: 'crea-mira',
    unread: 1,
    muted: true,
  },
  {
    id: 'conv-marcus',
    creatorId: 'crea-marcus',
    unread: 0,
  },
];

/* ---------------- messages ---------------- */

interface SeedMessage {
  id: string;
  fromMe: boolean;
  kind: MessageKind;
  text?: string;
  audioDuration?: number;
  waveSeed?: number;
  sentAt: number;
  status?: MessageStatus;
  deleted?: boolean;
}

const now = DEMO_NOW;

const lunaSeed: SeedMessage[] = [
  { id: 'lu-01', fromMe: true, kind: 'text', text: 'That field recording you posted yesterday is beautiful.', sentAt: now - 2 * DAY - 3 * HOUR, status: 'seen' },
  { id: 'lu-02', fromMe: false, kind: 'text', text: 'Thank you — it took three nights to catch that train, and the fourth to catch the silence after it.', sentAt: now - 2 * DAY - 2 * HOUR, status: 'seen' },
  { id: 'lu-03', fromMe: true, kind: 'text', text: 'Listen from 02:17. The room tone changes completely once the doors close.', sentAt: now - 2 * DAY - HOUR, status: 'seen' },
  { id: 'lu-04', fromMe: false, kind: 'text', text: 'I’ve been looking for that kind of atmosphere for weeks.', sentAt: now - 2 * DAY - 40 * MIN, status: 'seen' },
  { id: 'lu-05', fromMe: true, kind: 'text', text: 'Sending you the raw version — don’t judge the background noise.', sentAt: now - DAY - 5 * HOUR, status: 'seen' },
  { id: 'lu-06', fromMe: false, kind: 'audio', audioDuration: 24, waveSeed: 7, sentAt: now - DAY - 4 * HOUR, status: 'seen' },
  { id: 'lu-07', fromMe: true, kind: 'text', text: 'That transition at the end is insane.', sentAt: now - DAY - 3 * HOUR, status: 'seen' },
  { id: 'lu-08', fromMe: false, kind: 'text', text: 'You should hear this one…', sentAt: now - 50 * MIN, status: 'delivered' },
  { id: 'lu-09', fromMe: false, kind: 'text', text: 'Recorded it under the overpass at 4am. The whole city hums at a different pitch down there.', sentAt: now - 12 * MIN, status: 'delivered' },
];

const elioSeed: SeedMessage[] = [
  { id: 'el-01', fromMe: false, kind: 'text', text: 'Episode 43 is recorded. I kept your bit about the empty arena.', sentAt: now - 3 * DAY, status: 'seen' },
  { id: 'el-02', fromMe: true, kind: 'text', text: 'You kept it? I was sure you’d cut it.', sentAt: now - 3 * DAY + 2 * HOUR, status: 'seen' },
  { id: 'el-03', fromMe: false, kind: 'text', text: 'It’s the best part. The audience thinks they heard a crowd — they’re hearing your room tone.', sentAt: now - 3 * DAY + 3 * HOUR, status: 'seen' },
  { id: 'el-04', fromMe: true, kind: 'text', text: 'Ha. Well, tell them it’s applause from a football stadium. That’s a better story.', sentAt: now - 2 * DAY, status: 'seen' },
  { id: 'el-05', fromMe: false, kind: 'audio', audioDuration: 47, waveSeed: 13, sentAt: now - DAY - 6 * HOUR, status: 'seen' },
  { id: 'el-06', fromMe: true, kind: 'text', text: 'Forty-seven seconds of nothing but a door? You’re a menace.', sentAt: now - DAY - 5 * HOUR, status: 'seen' },
  { id: 'el-07', fromMe: false, kind: 'text', text: 'It’s not nothing. It’s the show’s heartbeat.', sentAt: now - 4 * HOUR, status: 'seen' },
];

const ariaSeed: SeedMessage[] = [
  { id: 'ar-01', fromMe: false, kind: 'text', text: 'The Neon Bloom stems are up. Grab them before I change my mind.', sentAt: now - 3 * DAY, status: 'seen' },
  { id: 'ar-02', fromMe: true, kind: 'text', text: 'Grabbed. The second pad is exactly what the intro needed.', sentAt: now - 3 * DAY + HOUR, status: 'seen' },
  { id: 'ar-03', fromMe: false, kind: 'text', text: 'Good. Use it on the final version and no one will know it started as a demo.', sentAt: now - 3 * DAY + 2 * HOUR, status: 'seen' },
  { id: 'ar-04', fromMe: true, kind: 'text', text: 'The wrong chord is staying. It’s the honest one.', sentAt: now - 3 * DAY + 3 * HOUR, status: 'seen' },
];

const kairoSeed: SeedMessage[] = [
  { id: 'ka-01', fromMe: true, kind: 'text', text: 'The underpass recording — how did you get the busker to stay?', sentAt: now - DAY - 8 * HOUR, status: 'seen' },
  { id: 'ka-02', fromMe: false, kind: 'text', text: 'I didn’t. He stayed because the acoustics were too good to leave.', sentAt: now - DAY - 7 * HOUR, status: 'seen' },
  { id: 'ka-03', fromMe: true, kind: 'text', text: 'Hah. That’s the whole philosophy.', sentAt: now - DAY - 6 * HOUR, status: 'seen' },
  { id: 'ka-04', fromMe: false, kind: 'text', text: 'The tunnel does the mixing. I just hold the mic still.', sentAt: now - 5 * DAY, status: 'seen' },
];

const miraSeed: SeedMessage[] = [
  { id: 'mi-01', fromMe: true, kind: 'text', text: 'Did the harbor recording survive the ferry ride?', sentAt: now - DAY, status: 'seen' },
  { id: 'mi-02', fromMe: false, kind: 'text', text: 'Barely — the wind took half of it. What’s left is better.', sentAt: now - DAY + 30 * MIN, status: 'seen' },
  { id: 'mi-03', fromMe: false, kind: 'text', text: 'The five o’clock horn landed perfectly. You’ll hear it first.', sentAt: now - 3 * HOUR, status: 'delivered' },
];

const marcusSeed: SeedMessage[] = [
  { id: 'ma-01', fromMe: false, kind: 'text', text: 'Draft chapter of the elevator story is done. It ends the way you suggested.', sentAt: now - 2 * DAY, status: 'seen' },
  { id: 'ma-02', fromMe: true, kind: 'text', text: 'No notes. Send it to the narrator.', sentAt: now - 2 * DAY + HOUR, status: 'seen' },
  { id: 'ma-03', fromMe: false, kind: 'text', text: 'Too generous. Read the third paragraph again.', sentAt: now - 2 * DAY + 2 * HOUR, status: 'seen', deleted: true },
];

function materialize(seed: SeedMessage[]): ChatMessage[] {
  return seed.map((s) => ({
    id: s.id,
    fromMe: s.fromMe,
    kind: s.kind,
    text: s.text,
    audio: s.kind === 'audio' ? { duration: s.audioDuration ?? 10, waveform: seededWave(s.waveSeed ?? s.id.length) } : undefined,
    sentAt: s.sentAt,
    status: s.status ?? 'sent',
    deleted: s.deleted ?? false,
  }));
}

export const messagesByConversation: Record<string, ChatMessage[]> = {
  'conv-luna': materialize(lunaSeed),
  'conv-elio': materialize(elioSeed),
  'conv-aria': materialize(ariaSeed),
  'conv-kairo': materialize(kairoSeed),
  'conv-mira': materialize(miraSeed),
  'conv-marcus': materialize(marcusSeed),
};

export const conversationById: Record<string, Conversation> = Object.fromEntries(
  conversations.map((c) => [c.id, c]),
);
