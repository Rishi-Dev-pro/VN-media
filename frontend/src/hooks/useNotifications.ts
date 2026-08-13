import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppNotification, NotificationPreferences } from '../data/notifications';
import {
  createNotificationRepository,
} from '../services/notificationRepository';

const repo = createNotificationRepository();

/** Demo switch — `/notifications?demo=error` forces the error state. */
function demoError(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('demo') === 'error';
  } catch {
    return false;
  }
}

interface NotificationsState {
  notifications: AppNotification[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  preferences: NotificationPreferences;
  togglePreference: (key: keyof NotificationPreferences) => void;
}

/** Notification center state — live via the repository subscription. */
export function useNotifications(): NotificationsState {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    follows: true,
    likes: true,
    comments: true,
    messages: true,
  });

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(false);
    try {
      if (demoError()) throw new Error('demo error');
      const [list, prefs] = await Promise.all([repo.getNotifications(), repo.getPreferences()]);
      setNotifications(list);
      setPreferences(prefs);
    } catch {
      setError(true);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const unsub = repo.subscribe(() => void load(false));
    return unsub;
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const markRead = useCallback((id: string) => {
    void repo.markAsRead(id);
  }, []);

  const markAllRead = useCallback(() => {
    void repo.markAllAsRead();
  }, []);

  const togglePreference = useCallback((key: keyof NotificationPreferences) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      void repo.setPreference(key, next[key]);
      return next;
    });
  }, []);

  const unreadCount = useMemo(
    () => notifications.reduce((sum, n) => sum + (n.readAt === null ? 1 : 0), 0),
    [notifications],
  );

  return {
    notifications,
    loading,
    error,
    retry,
    unreadCount,
    markRead,
    markAllRead,
    preferences,
    togglePreference,
  };
}
