import { Bell } from 'lucide-react';
import type { NotificationPreferences as Preferences } from '../../data/notifications';
import './NotificationPreferences.css';

interface NotificationPreferencesProps {
  preferences: Preferences;
  onToggle: (key: keyof Preferences) => void;
}

const ROWS: { key: keyof Preferences; label: string; hint: string }[] = [
  { key: 'follows', label: 'People following you', hint: 'A new voice joins your circle.' },
  { key: 'likes', label: 'VoiceNote likes', hint: 'Someone loved what you made.' },
  { key: 'comments', label: 'VoiceNote comments', hint: 'A reply landed on your voice.' },
  { key: 'messages', label: 'Messages', hint: 'A private conversation arrives.' },
];

/** Compact session-local preference surface — affects future mock events only. */
export function NotificationPreferences({ preferences, onToggle }: NotificationPreferencesProps) {
  return (
    <section className="notif-prefs" aria-label="Notification preferences">
      <div className="notif-prefs__head">
        <span className="notif-prefs__icon" aria-hidden="true">
          <Bell size={15} />
        </span>
        <div>
          <h2 className="notif-prefs__title">Notification preferences</h2>
          <p className="notif-prefs__sub">Only affects new activity. Past notifications stay as they are.</p>
        </div>
      </div>

      <ul className="notif-prefs__rows">
        {ROWS.map(({ key, label, hint }) => {
          const enabled = preferences[key];
          return (
            <li key={key} className="notif-prefs__row">
              <span className="notif-prefs__meta">
                <span className="notif-prefs__label">{label}</span>
                <span className="notif-prefs__hint">{hint}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${label} ${enabled ? 'on' : 'off'}`}
                className={`switch ${enabled ? 'is-on' : ''}`}
                onClick={() => onToggle(key)}
              >
                <span className="switch__thumb" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
