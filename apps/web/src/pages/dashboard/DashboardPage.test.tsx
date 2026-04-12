import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { useRootStore } from '@/app/store/root-store';
import { selectedWeekToKey } from '@/shared/lib/time';

const mocks = vi.hoisted(() => ({
  getCurrentAttendance: vi.fn(),
  checkInAttendance: vi.fn(),
  checkOutAttendance: vi.fn(),
  getMyWeeklyStats: vi.fn(),
  getTeamCurrentWeekStats: vi.fn(),
  getMyRecords: vi.fn()
}));

vi.mock('@/features/attendance/attendance.api', () => ({
  getCurrentAttendance: mocks.getCurrentAttendance,
  checkInAttendance: mocks.checkInAttendance,
  checkOutAttendance: mocks.checkOutAttendance
}));

vi.mock('@/features/stats/stats.api', () => ({
  getMyWeeklyStats: mocks.getMyWeeklyStats,
  getTeamCurrentWeekStats: mocks.getTeamCurrentWeekStats
}));

vi.mock('@/features/records/records.api', () => ({
  getMyRecords: mocks.getMyRecords
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRootStore.setState({ selectedWeek: 'current' });
    // Default: empty records for heatmap — overridden per test if needed
    mocks.getMyRecords.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
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
        displayName: 'Alice',
        role: 'member',
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
});
