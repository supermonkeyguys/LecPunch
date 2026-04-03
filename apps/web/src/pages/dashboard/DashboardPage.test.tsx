import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

const mocks = vi.hoisted(() => ({
  getCurrentAttendance: vi.fn(),
  checkInAttendance: vi.fn(),
  checkOutAttendance: vi.fn(),
  getMyWeeklyStats: vi.fn(),
  getTeamCurrentWeekStats: vi.fn()
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

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.getMyWeeklyStats.mockResolvedValue([
      { weekKey: '2026-03-31', totalDurationSeconds: 7200, sessionsCount: 2 }
    ]);
    mocks.getTeamCurrentWeekStats.mockResolvedValue([
      { userId: 'user-1', displayName: 'Alice', role: 'member', totalDurationSeconds: 7200, sessionsCount: 2, weekKey: '2026-03-31' }
    ]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /上卡/i })).toBeInTheDocument();
    expect(screen.getByText(/当前未在打卡中/i)).toBeInTheDocument();
    expect(screen.getByText(/累计时长：02:00:00/i)).toBeInTheDocument();
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
    mocks.getMyWeeklyStats.mockResolvedValue([]);
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /下卡/i })).toBeInTheDocument();
    expect(screen.getByText('01:01:01')).toBeInTheDocument();
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
    mocks.getMyWeeklyStats.mockResolvedValue([]);
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

  it('renders the loaded elapsed duration for an active session', async () => {
    mocks.getCurrentAttendance.mockResolvedValue({
      hasActiveSession: true,
      session: {
        id: 'session-1',
        checkInAt: '2026-04-02T00:00:00.000Z',
        elapsedSeconds: 10
      }
    });
    mocks.getMyWeeklyStats.mockResolvedValue([]);
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
    mocks.getMyWeeklyStats.mockResolvedValue([]);
    mocks.getTeamCurrentWeekStats.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/接近 5 小时上限/i)).toBeInTheDocument();
  });
});
