import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MembersPage } from './MembersPage';

const mocks = vi.hoisted(() => ({
  getTeamCurrentWeekStats: vi.fn()
}));

vi.mock('@/features/stats/stats.api', () => ({
  getTeamCurrentWeekStats: mocks.getTeamCurrentWeekStats,
  getMyWeeklyStats: vi.fn(),
  getMemberWeeklyStats: vi.fn()
}));

describe('MembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state before member stats resolve', () => {
    mocks.getTeamCurrentWeekStats.mockReturnValue(new Promise(() => undefined));

    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/正在加载成员统计/i)).toBeInTheDocument();
  });

  it('shows error state when member stats request fails', async () => {
    mocks.getTeamCurrentWeekStats.mockRejectedValue(new Error('boom'));

    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/加载成员统计失败/i)).toBeInTheDocument();
  });

  it('renders team members from weekly stats', async () => {
    mocks.getTeamCurrentWeekStats.mockResolvedValue([
      {
        userId: 'user-1',
        displayName: 'Alice',
        role: 'member',
        totalDurationSeconds: 7200,
        sessionsCount: 2,
        weekKey: '2026-03-31'
      }
    ]);

    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Alice/i)).toBeInTheDocument();
    expect(screen.getByText(/02:00:00/i)).toBeInTheDocument();
    expect(screen.getByText(/member/i)).toBeInTheDocument();
  });
});
