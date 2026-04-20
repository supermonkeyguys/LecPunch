import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/app/store/auth-store';
import { AdminEventsPage } from './AdminEventsPage';

const mocks = vi.hoisted(() => ({
  getAdminTeamEvents: vi.fn(),
  createAdminTeamEvent: vi.fn(),
  updateAdminTeamEvent: vi.fn()
}));

vi.mock('@/features/team-events/team-events.api', () => ({
  getAdminTeamEvents: mocks.getAdminTeamEvents,
  createAdminTeamEvent: mocks.createAdminTeamEvent,
  updateAdminTeamEvent: mocks.updateAdminTeamEvent
}));

describe('AdminEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      auth: {
        token: 'token',
        user: {
          id: 'admin-1',
          teamId: 'team-1',
          username: 'admin',
          displayName: 'Admin',
          role: 'admin',
          status: 'active',
          enrollYear: 2024,
          createdAt: '2026-04-11T00:00:00.000Z',
          updatedAt: '2026-04-11T00:00:00.000Z'
        }
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads and filters events from admin API', async () => {
    mocks.getAdminTeamEvents.mockResolvedValue([
      {
        id: 'event-1',
        teamId: 'team-1',
        title: '周例会',
        description: '同步进度',
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
        <AdminEventsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('周例会')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('状态筛选'), 'done');
    expect(screen.queryByText('周例会')).not.toBeInTheDocument();
    expect(screen.getByText('月度复盘')).toBeInTheDocument();
  });

  it('creates a new event from the admin form', async () => {
    mocks.getAdminTeamEvents.mockResolvedValue([]);
    mocks.createAdminTeamEvent.mockResolvedValue({
      id: 'event-9',
      teamId: 'team-1',
      title: '训练营答疑',
      description: '第一次集中答疑',
      eventAt: '2026-05-23T10:00:00.000Z',
      status: 'planned',
      createdBy: 'admin-1',
      updatedBy: 'admin-1',
      createdAt: '2026-05-20T10:00:00.000Z',
      updatedAt: '2026-05-20T10:00:00.000Z'
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminEventsPage />
      </MemoryRouter>
    );

    await user.type(await screen.findByLabelText('活动标题'), '训练营答疑');
    await user.type(screen.getByLabelText('活动说明（可选）'), '第一次集中答疑');
    fireEvent.change(screen.getByLabelText('活动时间'), { target: { value: '2026-05-23T18:00' } });
    await user.click(screen.getByRole('button', { name: '新增活动' }));

    await waitFor(() => {
      expect(mocks.createAdminTeamEvent).toHaveBeenCalledTimes(1);
    });

    const payload = mocks.createAdminTeamEvent.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: '训练营答疑',
      description: '第一次集中答疑',
      status: 'planned'
    });
    expect(new Date(payload.eventAt).toString()).not.toBe('Invalid Date');
    expect(screen.getByText('训练营答疑')).toBeInTheDocument();
  });

  it('updates event status from list actions', async () => {
    mocks.getAdminTeamEvents.mockResolvedValue([
      {
        id: 'event-1',
        teamId: 'team-1',
        title: '周例会',
        description: '',
        eventAt: '2026-05-20T10:00:00.000Z',
        status: 'planned',
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T10:00:00.000Z'
      }
    ]);
    mocks.updateAdminTeamEvent.mockResolvedValue({
      id: 'event-1',
      teamId: 'team-1',
      title: '周例会',
      description: '',
      eventAt: '2026-05-20T10:00:00.000Z',
      status: 'done',
      createdBy: 'admin-1',
      updatedBy: 'admin-1',
      createdAt: '2026-05-20T10:00:00.000Z',
      updatedAt: '2026-05-20T10:00:00.000Z'
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminEventsPage />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: '标记完成' }));
    await waitFor(() => {
      expect(mocks.updateAdminTeamEvent).toHaveBeenCalledWith('event-1', { status: 'done' });
    });
  });
});
