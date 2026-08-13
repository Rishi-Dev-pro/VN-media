import { Heart, Mail, MessageCircle, UserPlus, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getCreator } from '../../data/mockCreators';
import type { AppNotification, NotificationType } from '../../data/notifications';
import { Avatar } from '../common/Avatar';
import './NotificationToast.css';

const EVENT_ICON: Record<NotificationType, LucideIcon> = {
  USER_FOLLOWED: UserPlus,
  VOICE_NOTE_LIKED: Heart,
  VOICE_NOTE_COMMENTED: MessageCircle,
  MESSAGE_RECEIVED: Mail,
};

interface NotificationToastProps {
  notification: AppNotification;
  onDismiss: () => void;
  onOpen: () => void;
}

export function NotificationToast({ notification, onDismiss, onOpen }: NotificationToastProps) {
  const creator = getCreator(notification.actorId);
  const Icon = EVENT_ICON[notification.type];

  let line: string;
  switch (notification.type) {
    case 'USER_FOLLOWED':
      line = 'followed you';
      break;
    case 'VOICE_NOTE_LIKED':
      line = 'liked your VoiceNote';
      break;
    case 'VOICE_NOTE_COMMENTED':
      line = 'commented on your VoiceNote';
      break;
    default:
      line = 'sent you a message';
  }

  return (
    <div className="notif-toast" role="status" aria-live="polite">
      <button
        type="button"
        className="notif-toast__body"
        onClick={onOpen}
        aria-label={`${creator.name} ${line} — open`}
      >
        <span className="notif-toast__icon" aria-hidden="true">
          <Icon size={13} strokeWidth={2} />
        </span>
        <Avatar src={creator.avatar} alt={creator.name} size={36} />
        <span className="notif-toast__text">
          <span className="notif-toast__name">{creator.name}</span>
          <span className="notif-toast__line">{line}</span>
        </span>
      </button>
      <button
        type="button"
        className="notif-toast__dismiss"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
