import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { useRootStore } from '@/app/store/root-store';
import { selectedWeekToKey } from '@/shared/lib/time';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getCurrentAttendance: vi.fn(),
  getTeamActiveAttendances: vi.fn(),
  checkInAttendance: vi.fn(),
  checkOutAttendance: vi.fn(),
  keepAliveAttendance: vi.fn(),
  getMyWeeklyStats: vi.fn(),
  getTeamCurrentWeekStats: vi.fn(),
  getMyRecords: vi.fn(),
  getMyNotifications: vi.fn(),
  acknowledgeNotification: vi.fn(),
  connectNotificationStream: vi.fn(),
  showToast: vi.fn()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate
  };
});

vi.mock('@/features/attendance/attendance.api', () => ({
  getCurrentAttendance: mocks.getCurrentAttendance,
  getTeamActiveAttendances: mocks.getTeamActiveAttendances,
  checkInAttendance: mocks.checkInAttendance,
  checkOutAttendance: mocks.checkOutAttendance,
  keepAliveAttendance: mocks.keepAliveAttendance
}));

vi.mock('@/features/stats/stats.api', () => ({
  getMyWeeklyStats: mocks.getMyWeeklyStats,
  getTeamCurrentWeekStats: mocks.getTeamCurrentWeekStats
}));

vi.mock('@/features/records/records.api', () => ({
  getMyRecords: mocks.getMyRecords
}));

vi.mock('@/features/notifications/notifications.api', () => ({
  getMyNotifications: mocks.getMyNotifications,
  acknowledgeNotification: mocks.acknowledgeNotification,
  connectNotificationStream: mocks.connectNotificationStream
}));

vi.mock('@/shared/ui/toast', () => ({
  showToast: mocks.showToast
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRootStore.setState({
      selectedWeek: 'current',
      auth: {
        token: 'token-1',
        user: {
          id: 'user-1',
          teamId: 'team-1',
          username: 'alice',
          displayName: 'Alice',
          role: 'member',
          status: 'active',
          enrollYear: 2024,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z'
        }
      }
    });
    mocks.navigate.mockReset();
    mocks.getMyRecords.mockResolvedValue([]);
    mocks.getTeamActiveAttendances.mockResolvedValue([]);
    mocks.keepAliveAttendance.mockResolvedValue({});
    mocks.getMyNotifications.mockResolvedValue([]);
    mocks.connectNotificationStream.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('loads current attendance and shows check-in action when there is no active session', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: false,
      session: null
    });
    mocks.getMyWeeklyStats.mockResolvedValue({
      items: [{ weekKey: '2026-03-31', totalDurationSeconds: 7200, sessionsCount: 2 }],
      weeklyGoalSeconds: 38 * 3600
    });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([
      {
        memberKey: 'member-key-1',
        displayName: 'Alice',
        enrollYear: 2024,
        totalDurationSeconds: 7200,
        sessionsCount: 2,
        weekKey: '2026-03-31'
      }
    ]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /上卡/i })).toBeInTheDocument();
    expect(screen.getByText(/当前未打卡/i)).toBeInTheDocument();
    expect(screen.getAllByText(/02:00:00/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Alice/i)).toBeInTheDocument();
  });

  it('shows active timer and check-out action when an active session exists', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: true,
      session: {
        id: 'session-1',
        checkInAt: '2026-04-02T00:00:00.000Z',
        elapsedSeconds: 3661
      }
    });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /下卡/i })).toBeInTheDocument();
    expect(screen.getAllByText('01:01:01').length).toBeGreaterThan(0);
  });

  it('sends periodic keepalive requests while an active session is running', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: true,
      session: {
        id: 'session-1',
        checkInAt: '2026-04-02T00:00:00.000Z',
        elapsedSeconds: 30
      }
    });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    let keepAliveInterval: (() => void | Promise<void>) | undefined;

    globalThis.setInterval = (((callback: TimerHandler, delay?: number) => {
      if (delay === 30_000 && typeof callback === 'function') {
        keepAliveInterval = callback as () => void | Promise<void>;
      }

      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as unknown) as typeof setInterval;

    globalThis.clearInterval = ((() => undefined) as unknown) as typeof clearInterval;

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /下卡/i })).toBeInTheDocument();

    expect(keepAliveInterval).toBeTypeOf('function');

    await act(async () => {
      await keepAliveInterval?.();
    });

    expect(mocks.keepAliveAttendance).toHaveBeenCalledTimes(1);
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  });

  it('submits check-in and refreshes the current session', async () => {
    mocks.getCurrentAttendance
      .mockResolvedValueOnce({ hasActiveSession: false, session: null })
      .mockResolvedValueOnce({
        hasActiveSession: true,
        session: {
          id: 'session-2',
          checkInAt: '2026-04-02T01:00:00.000Z',
          elapsedSeconds: 0
        }
      });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);
    mocks.checkInAttendance.mockResolvedValue({ id: 'session-2' });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: /上卡/i }));

    await waitFor(() => {
      expect(mocks.checkInAttendance).toHaveBeenCalledTimes(1);
      expect(mocks.getCurrentAttendance).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a clear alert when check-in is blocked by the network policy', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: false,
      session: null
    });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);
    mocks.checkInAttendance.mockRejectedValue({
      response: {
        data: {
          code: 'ATTENDANCE_NETWORK_NOT_ALLOWED',
          message: 'Current network is not allowed for attendance'
        }
      }
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: /上卡/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('网络');
    expect(alert).toHaveTextContent('打卡');
    expect(mocks.getCurrentAttendance).toHaveBeenCalledTimes(1);
  });

  it('renders the loaded elapsed duration for an active session', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: true,
      session: {
        id: 'session-1',
        checkInAt: '2026-04-02T00:00:00.000Z',
        elapsedSeconds: 10
      }
    });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('00:00:10')).toBeInTheDocument();
  });

  it('shows overtime warning states near the five-hour limit', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: true,
      session: {
        id: 'session-1',
        checkInAt: '2026-04-02T00:00:00.000Z',
        elapsedSeconds: 16200
      }
    });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText((content) => content.includes('接近') || content.includes('即将'))).toBeInTheDocument();
  });

  it('shows a historical summary and disables attendance actions for non-current weeks', async () => {
    useRootStore.setState({ selectedWeek: 'prev1' });
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: true,
      session: {
        id: 'session-1',
        checkInAt: '2026-04-02T00:00:00.000Z',
        elapsedSeconds: 3661
      }
    });
    mocks.getMyWeeklyStats.mockResolvedValue({
      items: [
        {
          weekKey: selectedWeekToKey('prev1'),
          totalDurationSeconds: 7200,
          sessionsCount: 2
        }
      ],
      weeklyGoalSeconds: 38 * 3600
    });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/当前查看 上周，不可打卡。/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /上卡|下卡/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('02:00:00').length).toBeGreaterThan(0);
  });

  it('renders the live active attendance monitor at the bottom of the dashboard', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-02T00:02:00.000Z').getTime());

    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: false,
      session: null
    });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);
    mocks.getTeamActiveAttendances.mockResolvedValue([
      {
        memberKey: 'member-key-2',
        displayName: 'Bob',
        enrollYear: 2023,
        avatarColor: '#22c55e',
        avatarEmoji: '🟢',
        checkInAt: '2026-04-02T00:00:00.000Z',
        elapsedSeconds: 120,
        weekKey: '2026-03-31'
      }
    ]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('当前在线打卡成员')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('1 人在线')).toBeInTheDocument();
    expect(screen.getByText('00:02:00')).toBeInTheDocument();
  });

  it('renders pending dashboard notifications loaded from the API', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: false,
      session: null
    });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);
    mocks.getMyNotifications.mockResolvedValue([
      {
        id: 'notification-1',
        teamId: 'team-1',
        userId: 'user-1',
        type: 'attendance.record_marked',
        title: '打卡记录已被标记',
        message: '管理员标记了一条你的打卡记录，请进入记录页查看详情。',
        payload: {
          recordId: 'session-1',
          memberKey: 'member-key-user-1',
          weekKey: '2026-03-31'
        },
        sourceType: 'attendance_record',
        sourceId: 'session-1',
        createdBy: 'admin-1',
        createdAt: '2026-04-16T00:00:00.000Z',
        acknowledgedAt: null
      }
    ]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('待确认通知')).toBeInTheDocument();
    expect(screen.getByText('打卡记录已被标记')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '知道了' })).toBeInTheDocument();
    expect(mocks.getMyNotifications).toHaveBeenCalledWith({ status: 'unacked', limit: 20 });
  });

  it('acknowledges a notification and removes it from the dashboard queue', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: false,
      session: null
    });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);
    mocks.getMyNotifications.mockResolvedValue([
      {
        id: 'notification-1',
        teamId: 'team-1',
        userId: 'user-1',
        type: 'attendance.record_marked',
        title: '打卡记录已被标记',
        message: '管理员标记了一条你的打卡记录，请进入记录页查看详情。',
        payload: {
          recordId: 'session-1',
          memberKey: 'member-key-user-1',
          weekKey: '2026-03-31'
        },
        sourceType: 'attendance_record',
        sourceId: 'session-1',
        createdBy: 'admin-1',
        createdAt: '2026-04-16T00:00:00.000Z',
        acknowledgedAt: null
      }
    ]);
    mocks.acknowledgeNotification.mockResolvedValue({
      id: 'notification-1'
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: '知道了' }));

    await waitFor(() => {
      expect(mocks.acknowledgeNotification).toHaveBeenCalledWith('notification-1');
      expect(screen.queryByText('打卡记录已被标记')).not.toBeInTheDocument();
    });
  });

  it('appends live notifications from the SSE stream and can open the records page after acknowledgement', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: false,
      session: null
    });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);
    mocks.getMyNotifications.mockResolvedValue([]);
    mocks.acknowledgeNotification.mockResolvedValue({
      id: 'notification-2'
    });

    let eventHandler: ((event: { event: string; data: unknown }) => void) | undefined;
    mocks.connectNotificationStream.mockImplementation(async (_token, handlers) => {
      eventHandler = handlers.onEvent;
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.connectNotificationStream).toHaveBeenCalledTimes(1);
    });

    eventHandler?.({
      event: 'notification.created',
      data: {
        id: 'notification-2',
        teamId: 'team-1',
        userId: 'user-1',
        type: 'attendance.record_marked',
        title: '新的标记通知',
        message: '请查看你的记录。',
        payload: {
          recordId: 'session-2',
          memberKey: 'member-key-user-1',
          weekKey: '2026-03-31'
        },
        sourceType: 'attendance_record',
        sourceId: 'session-2',
        createdBy: 'admin-1',
        createdAt: '2026-04-16T01:00:00.000Z',
        acknowledgedAt: null
      }
    });

    expect(await screen.findByText('新的标记通知')).toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalledWith('新的标记通知');

    await user.click(screen.getByRole('button', { name: '查看记录' }));

    await waitFor(() => {
      expect(mocks.acknowledgeNotification).toHaveBeenCalledWith('notification-2');
      expect(mocks.navigate).toHaveBeenCalledWith('/records');
    });
  });

  it('reconnects the notification stream after an unexpected stream failure', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: false,
      session: null
    });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);

    let handlersRef:
      | {
          onError?: (error: unknown) => void;
        }
      | undefined;
    mocks.connectNotificationStream.mockImplementation(async (_token, handlers) => {
      handlersRef = handlers;
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.connectNotificationStream).toHaveBeenCalledTimes(1);
    });

    vi.useFakeTimers();
    await act(async () => {
      handlersRef?.onError?.(new Error('stream dropped'));
    });

    expect(screen.getByText('实时通知连接失败，正在重试')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mocks.connectNotificationStream).toHaveBeenCalledTimes(2);
  });

  it('does not reconnect the notification stream after the dashboard unmounts', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: false,
      session: null
    });
    mocks.getMyWeeklyStats.mockResolvedValue({ items: [], weeklyGoalSeconds: 0 });
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);

    let handlersRef:
      | {
          onError?: (error: unknown) => void;
        }
      | undefined;
    mocks.connectNotificationStream.mockImplementation(async (_token, handlers) => {
      handlersRef = handlers;
    });

    const view = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.connectNotificationStream).toHaveBeenCalledTimes(1);
    });

    vi.useFakeTimers();
    handlersRef?.onError?.(new Error('stream dropped'));
    view.unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mocks.connectNotificationStream).toHaveBeenCalledTimes(1);
  });
});
