import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('notifications.api', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('parses SSE events from the notification stream', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              'event: connected',
              'data: {"connectedAt":"2026-04-16T00:00:00.000Z"}',
              '',
              'event: notification.created',
              'data: {"id":"notification-1","title":"打卡记录已被标记"}',
              '',
              'event: heartbeat',
              'data: {"timestamp":"2026-04-16T00:00:30.000Z"}',
              '',
            ].join('\n')
          )
        );
        controller.close();
      }
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream'
        }
      })
    );

    const { connectNotificationStream } = await import('./notifications.api');
    const onEvent = vi.fn();
    const onError = vi.fn();

    await connectNotificationStream('token-1', {
      signal: new AbortController().signal,
      onEvent,
      onError
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/notifications/stream', {
      headers: {
        Authorization: 'Bearer token-1',
        Accept: 'text/event-stream'
      },
      signal: expect.any(AbortSignal)
    });
    expect(onEvent).toHaveBeenNthCalledWith(1, {
      event: 'connected',
      data: { connectedAt: '2026-04-16T00:00:00.000Z' }
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      event: 'notification.created',
      data: { id: 'notification-1', title: '打卡记录已被标记' }
    });
    expect(onEvent).toHaveBeenNthCalledWith(3, {
      event: 'heartbeat',
      data: { timestamp: '2026-04-16T00:00:30.000Z' }
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
