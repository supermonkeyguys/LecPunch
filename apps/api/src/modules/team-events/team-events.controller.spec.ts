import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TeamEventsController } from './team-events.controller';

const adminUser: AuthUser = {
  userId: 'admin-1',
  teamId: 'team-1',
  role: 'admin',
  username: 'admin',
  displayName: 'Admin',
  enrollYear: 2024
};

const memberUser: AuthUser = {
  ...adminUser,
  userId: 'member-1',
  role: 'member',
  username: 'member',
  displayName: 'Member'
};

describe('TeamEventsController', () => {
  const teamEventsService = {
    listEvents: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn()
  };

  let controller: TeamEventsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new TeamEventsController(teamEventsService as never);
  });

  it('lists events for admins with query filters', async () => {
    teamEventsService.listEvents.mockResolvedValue([
      {
        id: 'event-1',
        teamId: 'team-1',
        title: 'Weekly Meeting',
        description: 'sync',
        eventAt: new Date('2026-05-01T10:00:00.000Z'),
        status: 'planned',
        createdBy: 'admin-1',
        updatedBy: 'admin-1',
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T00:00:00.000Z')
      }
    ]);

    const result = await controller.listEvents(adminUser, {
      status: 'planned',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.000Z',
      limit: 20
    });

    expect(teamEventsService.listEvents).toHaveBeenCalledWith('team-1', {
      status: 'planned',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.000Z',
      limit: 20
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'event-1',
      teamId: 'team-1',
      title: 'Weekly Meeting',
      status: 'planned'
    });
  });

  it('creates and updates events scoped to the admin team', async () => {
    teamEventsService.createEvent.mockResolvedValue({
      id: 'event-1',
      teamId: 'team-1',
      title: 'Weekly Meeting',
      eventAt: '2026-05-01T10:00:00.000Z',
      status: 'planned',
      createdBy: 'admin-1',
      updatedBy: 'admin-1'
    });
    teamEventsService.updateEvent.mockResolvedValue({
      id: 'event-1',
      teamId: 'team-1',
      title: 'Weekly Meeting',
      eventAt: '2026-05-01T10:00:00.000Z',
      status: 'done',
      createdBy: 'admin-1',
      updatedBy: 'admin-1'
    });

    await controller.createEvent(adminUser, {
      title: 'Weekly Meeting',
      description: 'sync',
      eventAt: '2026-05-01T10:00:00.000Z',
      status: 'planned'
    });
    await controller.updateEvent(adminUser, 'event-1', { status: 'done' });

    expect(teamEventsService.createEvent).toHaveBeenCalledWith({
      teamId: 'team-1',
      title: 'Weekly Meeting',
      description: 'sync',
      eventAt: '2026-05-01T10:00:00.000Z',
      status: 'planned',
      createdBy: 'admin-1'
    });
    expect(teamEventsService.updateEvent).toHaveBeenCalledWith('team-1', 'event-1', {
      status: 'done',
      updatedBy: 'admin-1'
    });
  });

  it('rejects member access to admin event routes', async () => {
    await expect(controller.listEvents(memberUser, { limit: 20 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.createEvent(memberUser, {
        title: 'Weekly Meeting',
        eventAt: '2026-05-01T10:00:00.000Z'
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.updateEvent(memberUser, 'event-1', { status: 'done' })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
