import { useEffect, useRef, useState } from 'react';
import type { NotificationItem } from '@lecpunch/shared';
import { acknowledgeNotification, connectNotificationStream, getMyNotifications, type NotificationStreamEvent } from './notifications.api';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { showToast } from '@/shared/ui/toast';

const sortNotifications = (items: NotificationItem[]) =>
  [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

const upsertNotification = (items: NotificationItem[], incoming: NotificationItem) => {
  const next = items.filter((item) => item.id !== incoming.id);
  next.push(incoming);
  return sortNotifications(next);
};

export const useDashboardNotifications = (token: string | null) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const notificationsRef = useRef<NotificationItem[]>([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadNotifications = async () => {
      setLoading(true);
      setError(null);

      try {
        const items = await getMyNotifications({ status: 'unacked', limit: 20 });
        if (!cancelled) {
          setNotifications(sortNotifications(items));
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setLoading(false);
          setError(getApiErrorMessage(error, '加载通知失败，请稍后重试'));
        }
      }
    };

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const controller = new AbortController();

    const handleEvent = (event: NotificationStreamEvent) => {
      if (event.event === 'connected') {
        setError(null);
        return;
      }

      if (event.event !== 'notification.created') {
        return;
      }

      const incoming = event.data as NotificationItem;
      const isNew = !notificationsRef.current.some((item) => item.id === incoming.id);

      setNotifications((current) => upsertNotification(current, incoming));

      if (isNew) {
        showToast(incoming.title);
      }
    };

    void connectNotificationStream(token, {
      signal: controller.signal,
      onEvent: handleEvent,
      onError: (error) => {
        setError(getApiErrorMessage(error, '实时通知连接失败，请刷新页面重试'));
      }
    });

    return () => {
      controller.abort();
    };
  }, [token]);

  const acknowledge = async (notificationId: string) => {
    setPendingIds((current) => [...current, notificationId]);

    try {
      await acknowledgeNotification(notificationId);
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error, '确认通知失败，请稍后重试'), 'error');
      return false;
    } finally {
      setPendingIds((current) => current.filter((id) => id !== notificationId));
    }
  };

  return {
    notifications,
    loading,
    error,
    pendingIds,
    acknowledge
  };
};
