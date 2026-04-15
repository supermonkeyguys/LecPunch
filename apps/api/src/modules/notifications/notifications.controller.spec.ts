import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  const notificationsService = {
    listForUser: vi.fn(),
    acknowledge: vi.fn(),
    subscribe: vi.fn(),
    createConnectedEvent: vi.fn(),
    createHeartbeatEvent: vi.fn()
  };

  let controller: NotificationsController;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    controller = new NotificationsController(notificationsService as any);
  });

  it('returns current user notifications with bounded query params', async () => {
    notificationsService.listForUser.mockResolvedValue([{ id: 'notification-1' }]);

    const result = await controller.listMyNotifications(
      { userId: 'user-1', teamId: 'team-1', role: 'member' } as any,
      'all',
      '999'
    );

    expect(notificationsService.listForUser).toHaveBeenCalledWith('team-1', 'user-1', {
      status: 'all',
      limit: 100
    });
    expect(result).toEqual({
      items: [{ id: 'notification-1' }]
    });
  });

  it('acknowledges notifications for the current user only', async () => {
    notificationsService.acknowledge.mockResolvedValue({ id: 'notification-1', acknowledgedAt: '2026-04-16T00:00:00.000Z' });

    const result = await controller.acknowledgeNotification(
      { userId: 'user-1', teamId: 'team-1', role: 'member' } as any,
      'notification-1'
    );

    expect(notificationsService.acknowledge).toHaveBeenCalledWith('team-1', 'user-1', 'notification-1');
    expect(result).toEqual({ id: 'notification-1', acknowledgedAt: '2026-04-16T00:00:00.000Z' });
  });

  it('opens an SSE stream, emits connected and heartbeat events, and cleans up on close', async () => {
    vi.useFakeTimers();
    const unsubscribe = vi.fn();
    let closeHandler: (() => void) | undefined;
    notificationsService.subscribe.mockReturnValue(unsubscribe);
    notificationsService.createConnectedEvent.mockReturnValue({
      event: 'connected',
      data: { connectedAt: '2026-04-16T00:00:00.000Z' }
    });
    notificationsService.createHeartbeatEvent.mockReturnValue({
      event: 'heartbeat',
      data: { timestamp: '2026-04-16T00:00:30.000Z' }
    });

    const request = {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'close') {
          closeHandler = handler;
        }
      })
    } as any;
    const response = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn()
    } as any;

    controller.streamNotifications({ userId: 'user-1', teamId: 'team-1', role: 'member' } as any, request, response);

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform');
    expect(response.flushHeaders).toHaveBeenCalledTimes(1);
    expect(notificationsService.subscribe).toHaveBeenCalledWith('user-1', expect.any(Function));
    expect(response.write).toHaveBeenNthCalledWith(1, 'event: connected\n');
    expect(response.write).toHaveBeenNthCalledWith(2, 'data: {"connectedAt":"2026-04-16T00:00:00.000Z"}\n\n');

    vi.advanceTimersByTime(30_000);

    expect(response.write).toHaveBeenNthCalledWith(3, 'event: heartbeat\n');
    expect(response.write).toHaveBeenNthCalledWith(4, 'data: {"timestamp":"2026-04-16T00:00:30.000Z"}\n\n');

    closeHandler?.();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(response.end).toHaveBeenCalledTimes(1);
  });
});
