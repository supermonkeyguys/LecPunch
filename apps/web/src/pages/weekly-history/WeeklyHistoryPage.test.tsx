import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WeeklyHistoryPage } from './WeeklyHistoryPage';

const mocks = vi.hoisted(() => ({
  getMyWeeklyStats: vi.fn()
}));

vi.mock('@/features/stats/stats.api', () => ({
  getTeamCurrentWeekStats: vi.fn(),
  getMyWeeklyStats: mocks.getMyWeeklyStats,
  getMemberWeeklyStats: vi.fn()
}));

describe('WeeklyHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state before weekly stats resolve', () => {
    mocks.getMyWeeklyStats.mockReturnValue(new Promise(() => undefined));

    render(
      <MemoryRouter>
        <WeeklyHistoryPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/正在加载/i)).toBeInTheDocument();
  });

  it('shows error state when weekly stats request fails', async () => {
    mocks.getMyWeeklyStats.mockRejectedValue(new Error('boom'));

    render(
      <MemoryRouter>
        <WeeklyHistoryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/加载周历史统计失败/i)).toBeInTheDocument();
  });

  it('renders weekly history rows', async () => {
    mocks.getMyWeeklyStats.mockResolvedValue({
      items: [
        {
          weekKey: '2026-03-31',
          totalDurationSeconds: 7200,
          sessionsCount: 2
        }
      ],
      weeklyGoalSeconds: 38 * 3600
    });

    render(
      <MemoryRouter>
        <WeeklyHistoryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('2026-03-31')).toBeInTheDocument();
    expect(screen.getByText('02:00:00')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
