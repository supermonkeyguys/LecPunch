import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

    expect(screen.getByText(/正在加载/i)).toBeInTheDocument();
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

  it('renders team members without showing raw ids and keeps the records action', async () => {
    mocks.getTeamCurrentWeekStats.mockResolvedValue([
      {
        memberKey: 'member-key-1',
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
        <MembersPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Alice$/i)).toBeInTheDocument();
    expect(screen.getByText(/02:00:00/i)).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /2024 级/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '筛选' })).toBeInTheDocument();
    expect(screen.getByLabelText('scope-team')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/ID:/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看流水/i })).toBeInTheDocument();
  });

  it('supports switching between same-grade and full-team scopes', async () => {
    const user = userEvent.setup();

    mocks.getTeamCurrentWeekStats
      .mockResolvedValueOnce([
        {
          memberKey: 'member-key-1',
          displayName: 'Alice',
          role: 'member',
          enrollYear: 2024,
          totalDurationSeconds: 7200,
          sessionsCount: 2,
          weekKey: '2026-03-31'
        }
      ])
      .mockResolvedValueOnce([
        {
          memberKey: 'member-key-2',
          displayName: 'Bob',
          role: 'member',
          enrollYear: 2025,
          totalDurationSeconds: 3600,
          sessionsCount: 1,
          weekKey: '2026-03-31'
        }
      ]);

    render(
      <MemoryRouter initialEntries={[{ pathname: '/members', state: { scope: 'same-grade' } }]}>
        <MembersPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Alice$/i)).toBeInTheDocument();
    expect(mocks.getTeamCurrentWeekStats).toHaveBeenNthCalledWith(1, true);

    await user.click(screen.getByLabelText('scope-team'));

    await waitFor(() => {
      expect(mocks.getTeamCurrentWeekStats).toHaveBeenNthCalledWith(2, false);
    });
    expect(await screen.findByText(/^Bob$/i)).toBeInTheDocument();
  });

  it('restores filters and sort state from the URL', async () => {
    mocks.getTeamCurrentWeekStats.mockResolvedValue([
      {
        memberKey: 'member-key-1',
        displayName: 'Alice',
        role: 'member',
        enrollYear: 2024,
        totalDurationSeconds: 7200,
        sessionsCount: 2,
        weekKey: '2026-03-31'
      },
      {
        memberKey: 'member-key-2',
        displayName: 'Bob',
        role: 'member',
        enrollYear: 2025,
        totalDurationSeconds: 3600,
        sessionsCount: 1,
        weekKey: '2026-03-31'
      },
      {
        memberKey: 'member-key-3',
        displayName: 'Bobby',
        role: 'member',
        enrollYear: 2025,
        totalDurationSeconds: 5400,
        sessionsCount: 3,
        weekKey: '2026-03-31'
      }
    ]);

    render(
      <MemoryRouter initialEntries={['/members?scope=same-grade&search=Bo&enrollYear=2025&minHours=1&maxHours=2&sort=count-asc']}>
        <MembersPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Bob$/)).toBeInTheDocument();
    expect(mocks.getTeamCurrentWeekStats).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText('scope-same-grade')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('member-search')).toHaveValue('Bo');
    expect(screen.getByLabelText('grade-filter')).toHaveValue('2025');
    expect(screen.getByLabelText('minimum-hours-filter')).toHaveValue(1);
    expect(screen.getByLabelText('maximum-hours-filter')).toHaveValue(2);

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    expect(within(firstDataRow).getByText(/^Bob$/i)).toBeInTheDocument();
  });

  it('keeps filters in the card and sorts from the table header controls', async () => {
    const user = userEvent.setup();

    mocks.getTeamCurrentWeekStats.mockResolvedValue([
      {
        memberKey: 'member-key-1',
        displayName: 'Alice',
        role: 'member',
        enrollYear: 2024,
        totalDurationSeconds: 7200,
        sessionsCount: 2,
        weekKey: '2026-03-31'
      },
      {
        memberKey: 'member-key-2',
        displayName: 'Bob',
        role: 'member',
        enrollYear: 2025,
        totalDurationSeconds: 3600,
        sessionsCount: 4,
        weekKey: '2026-03-31'
      }
    ]);

    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/^Alice$/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('grade-filter'), 'all');
    await user.click(screen.getByLabelText('sort-count'));

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    expect(within(firstDataRow).getByText(/^Bob$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('members-sort')).not.toBeInTheDocument();
  });
});
