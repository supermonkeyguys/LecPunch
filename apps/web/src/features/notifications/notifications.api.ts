import type { NotificationItem } from '@lecpunch/shared';
import { useRootStore } from '@/app/store/root-store';
import { apiClient } from '@/shared/http/api-client';

export interface NotificationFilters {
  status?: 'unacked' | 'all';
  limit?: number;
}

export type NotificationStreamEventName = 'connected' | 'notification.created' | 'heartbeat';

export interface NotificationStreamEvent {
  event: NotificationStreamEventName;
  data: unknown;
}

interface NotificationListResponse {
  items: NotificationItem[];
}

interface NotificationStreamHandlers {
  signal: AbortSignal;
  onEvent: (event: NotificationStreamEvent) => void;
  onError?: (error: unknown) => void;
}

const buildApiUrl = (path: string) => {
  const baseUrl = apiClient.defaults.baseURL ?? '/api';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (/^https?:\/\//.test(normalizedBase)) {
    return `${normalizedBase}${normalizedPath}`;
  }

  return new URL(`${normalizedBase}${normalizedPath}`, window.location.origin).toString();
};

const resetAuth = () => {
  useRootStore.getState().setAuth({ token: null, user: null });
};

const parseEventChunk = (chunk: string): NotificationStreamEvent | null => {
  const normalized = chunk.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return null;
  }

  let event: NotificationStreamEventName = 'heartbeat';
  const dataLines: string[] = [];

  for (const line of normalized.split('\n')) {
    if (line.startsWith('event:')) {
      const value = line.slice('event:'.length).trim() as NotificationStreamEventName;
      event = value;
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  }

  const rawData = dataLines.join('\n');
  if (!rawData) {
    return null;
  }

  try {
    return {
      event,
      data: JSON.parse(rawData)
    };
  } catch {
    return {
      event,
      data: rawData
    };
  }
};

export const getMyNotifications = async (filters?: NotificationFilters) => {
  const response = await apiClient.get<NotificationListResponse>('/notifications/me', {
    params: filters ?? undefined
  });
  return response.data.items;
};

export const acknowledgeNotification = async (notificationId: string) => {
  const response = await apiClient.patch<NotificationItem>(`/notifications/${notificationId}/ack`);
  return response.data;
};

export const connectNotificationStream = async (token: string, handlers: NotificationStreamHandlers) => {
  const response = await fetch(buildApiUrl('/notifications/stream'), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream'
    },
    signal: handlers.signal
  });

  if (response.status === 401) {
    resetAuth();
    throw new Error('登录已失效，请重新登录');
  }

  if (!response.ok || !response.body) {
    throw new Error(`通知连接失败 (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (!handlers.signal.aborted) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let boundaryIndex = buffer.indexOf('\n\n');
      while (boundaryIndex >= 0) {
        const chunk = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);
        const parsed = parseEventChunk(chunk);
        if (parsed) {
          handlers.onEvent(parsed);
        }
        boundaryIndex = buffer.indexOf('\n\n');
      }
    }

    buffer += decoder.decode();
    const parsed = parseEventChunk(buffer);
    if (parsed) {
      handlers.onEvent(parsed);
    }
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError' || handlers.signal.aborted) {
      return;
    }

    handlers.onError?.(error);
    return;
  } finally {
    reader.releaseLock();
  }

  if (!handlers.signal.aborted) {
    handlers.onError?.(new Error('通知连接已断开'));
  }
};
