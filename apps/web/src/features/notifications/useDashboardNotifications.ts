import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationItem } from '@lecpunch/shared';
import { acknowledgeNotification, connectNotificationStream, getMyNotifications, type NotificationStreamEvent } from './notifications.api';
import { STREAM_RETRY_DELAY_MS } from '@/shared/constants/timing';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
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
  const [streamError, setStreamError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [streamRetryToken, setStreamRetryToken] = useState(0);
  const notificationsRef = useRef<NotificationItem[]>([]);
  const retryTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(
    () => () => {
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    },
    []
  );

  const fetchNotifications = useCallback(
    async (_signal: AbortSignal) => {
      if (!token) {
        return [] as NotificationItem[];
      }

      const items = await getMyNotifications({ status: 'unacked', limit: 20 });
      return sortNotifications(items);
    },
    [token]
  );
  const {
    data: loadedNotifications,
    loading: initialLoading,
    error: initialLoadError
  } = useAsyncData(fetchNotifications, [token], {
    initialData: [] as NotificationItem[]
  });

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setStreamError(null);
      return;
    }

    setNotifications(loadedNotifications);
  }, [loadedNotifications, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const controller = new AbortController();
    const scheduleReconnect = (message: string) => {
      if (controller.signal.aborted) {
        return;
      }

      setStreamError(message);

      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
      }

      retryTimeoutRef.current = window.setTimeout(() => {
        retryTimeoutRef.current = null;
        setStreamRetryToken((current) => current + 1);
      }, STREAM_RETRY_DELAY_MS);
    };

    const handleEvent = (event: NotificationStreamEvent) => {
      if (event.event === 'connected') {
        if (retryTimeoutRef.current !== null) {
          window.clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        setStreamError(null);
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
        scheduleReconnect(getApiErrorMessage(error, '实时通知连接失败，正在重试'));
      }
    });

    return () => {
      controller.abort();
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [token, streamRetryToken]);

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
    loading: token ? initialLoading : false,
    error:
      streamError ??
      (initialLoadError ? getApiErrorMessage(initialLoadError, '加载通知失败，请稍后重试') : null),
    pendingIds,
    acknowledge
  };
};
