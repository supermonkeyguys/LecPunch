import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EventsPage } from './EventsPage';

const mocks = vi.hoisted(() => ({
  getTeamEvents: vi.fn()
}));

vi.mock('@/features/team-events/team-events.api', () => ({
  getTeamEvents: mocks.getTeamEvents
}));

describe('EventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads events and filters by status', async () => {
    mocks.getTeamEvents.mockResolvedValue([
      {
        id: 'event-1',
        teamId: 'team-1',
        title: '周例会',
        description: '同步项目进展',
        eventAt: '2026-05-20T10:00:00.000Z',
        status: 'planned',
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T10:00:00.000Z'
      },
      {
        id: 'event-2',
        teamId: 'team-1',
        title: '月度复盘',
        description: '',
        eventAt: '2026-05-21T10:00:00.000Z',
        status: 'done',
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T10:00:00.000Z'
      }
    ]);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <EventsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('周例会')).toBeInTheDocument();
    expect(mocks.getTeamEvents).toHaveBeenCalledTimes(1);
    await user.selectOptions(screen.getByLabelText('状态筛选'), 'done');
    expect(screen.queryByText('周例会')).not.toBeInTheDocument();
    expect(screen.getByText('月度复盘')).toBeInTheDocument();
    expect(mocks.getTeamEvents).toHaveBeenCalledTimes(1);
  });
});
