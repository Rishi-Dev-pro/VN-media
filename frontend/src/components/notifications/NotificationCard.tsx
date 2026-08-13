import { Heart, Mail, MessageCircle, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getCreator } from '../../data/mockCreators';
import { voiceNotesById } from '../../data/mockVoiceNotes';
import type { AppNotification, NotificationType } from '../../data/notifications';
import { DEMO_NOW } from '../../data/mockFollowing';
import { formatRelative } from '../../utils/format';
import { Avatar } from '../common/Avatar';
import './NotificationCard.css';

const EVENT_ICON: Record<NotificationType, LucideIcon> = {
  USER_FOLLOWED: UserPlus,
  VOICE_NOTE_LIKED: Heart,
  VOICE_NOTE_COMMENTED: MessageCircle,
  MESSAGE_RECEIVED: Mail,
};

interface NotificationCardProps {
  notification: AppNotification;
  index: number;
  onOpen: (notification: AppNotification) => void;
}

export function NotificationCard({ notification, index, onOpen }: NotificationCardProps) {
  const creator = getCreator(notification.actorId);
  const Icon = EVENT_ICON[notification.type];
  const unread = notification.readAt === null;
  const note = notification.voiceNoteId ? voiceNotesById[notification.voiceNoteId] : undefined;

  let line: string;
  let sub: string | undefined;
  switch (notification.type) {
    case 'USER_FOLLOWED':
      line = `${creator.name} followed you.`;
      break;
    case 'VOICE_NOTE_LIKED':
      line = `${creator.name} liked your VoiceNote.`;
      sub = note ? `"${note.title}"` : undefined;
      break;
    case 'VOICE_NOTE_COMMENTED':
      line = `${creator.name} commented on your VoiceNote.`;
      sub = notification.commentPreview ?? (note ? `"${note.title}"` : undefined);
      break;
    default:
      line = `${creator.name} sent you a message.`;
      sub = notification.commentPreview;
  }

  return (
    <button
      type="button"
      className={`notif-card ${unread ? 'is-unread' : ''}`}
      onClick={() => onOpen(notification)}
      aria-label={`${unread ? 'Unread — ' : ''}${line}${sub ? ` ${sub}` : ''}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <span className="notif-card__icon" aria-hidden="true">
        <Icon size={15} strokeWidth={2} />
      </span>

      <span className="notif-card__avatar">
        <Avatar src={creator.avatar} alt={creator.name} size={42} />
      </span>

      <span className="notif-card__body">
        <span className="notif-card__line">{line}</span>
        {sub && <span className="notif-card__sub">{sub}</span>}
        <span className="notif-card__time tabular">
          {formatRelative(new Date(notification.createdAt).toISOString(), DEMO_NOW)}
        </span>
      </span>

      {note && (
        <span className="notif-card__art" aria-hidden="true">
          <img src={note.cover} alt="" loading="lazy" width={44} height={44} />
        </span>
      )}

      {unread && (
        <span className="notif-card__unread" aria-hidden="true" title="Unread" />
      )}
    </button>
  );
}
