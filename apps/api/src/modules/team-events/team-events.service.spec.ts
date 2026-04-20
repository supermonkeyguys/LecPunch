import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ERROR_CODES } from '@lecpunch/shared';
import { TeamEventsService } from './team-events.service';

const create = vi.fn();
const find = vi.fn();
const findById = vi.fn();
const findOneAndUpdate = vi.fn();

const createService = () =>
  new TeamEventsService({
    create,
    find,
    findById,
    findOneAndUpdate
  } as any);

describe('TeamEventsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates events with normalized title/description and default planned status', async () => {
    create.mockResolvedValue({
      id: 'event-1',
      teamId: 'team-1',
      title: 'Team Weekly',
      description: 'sync',
      status: 'planned'
    });

    const service = createService();
    await service.createEvent({
      teamId: 'team-1',
      title: '  Team Weekly  ',
      description: '  sync  ',
      eventAt: '2026-04-28T10:00:00.000Z',
      createdBy: 'admin-1'
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        title: 'Team Weekly',
        description: 'sync',
        status: 'planned',
        createdBy: 'admin-1',
        updatedBy: 'admin-1'
      })
    );
  });

  it('lists events by team with status and time-range filters', async () => {
    const exec = vi.fn().mockResolvedValue([]);
    const limit = vi.fn().mockReturnValue({ exec });
    const sort = vi.fn().mockReturnValue({ limit });
    find.mockReturnValue({ sort });

    const service = createService();
    await service.listEvents('team-1', {
      status: 'planned',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.000Z',
      limit: 50
    });

    expect(find).toHaveBeenCalledWith({
      teamId: 'team-1',
      status: 'planned',
      eventAt: {
        $gte: new Date('2026-04-01T00:00:00.000Z'),
        $lte: new Date('2026-04-30T23:59:59.000Z')
      }
    });
    expect(sort).toHaveBeenCalledWith({ eventAt: -1, createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(50);
  });

  it('clamps listing limit into [1, 500]', async () => {
    const exec = vi.fn().mockResolvedValue([]);
    const limit = vi.fn().mockReturnValue({ exec });
    const sort = vi.fn().mockReturnValue({ limit });
    find.mockReturnValue({ sort });

    const service = createService();
    await service.listEvents('team-1', { limit: 0 });
    await service.listEvents('team-1', { limit: 999 });

    expect(limit).toHaveBeenNthCalledWith(1, 1);
    expect(limit).toHaveBeenNthCalledWith(2, 500);
  });

  it('updates event fields within the same team', async () => {
    findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        id: 'event-1',
        teamId: 'team-1'
      })
    });
    findOneAndUpdate.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        id: 'event-1',
        teamId: 'team-1',
        title: 'Updated title',
        description: 'updated desc',
        status: 'done',
        updatedBy: 'admin-2'
      })
    });

    const service = createService();
    await service.updateEvent('team-1', 'event-1', {
      title: '  Updated title  ',
      description: '  updated desc  ',
      status: 'done',
      updatedBy: 'admin-2'
    });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'event-1', teamId: 'team-1' },
      {
        $set: {
          title: 'Updated title',
          description: 'updated desc',
          status: 'done',
          updatedBy: 'admin-2'
        }
      },
      { new: true }
    );
  });

  it('rejects cross-team updates', async () => {
    findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        id: 'event-1',
        teamId: 'team-2'
      })
    });

    const service = createService();
    await expect(
      service.updateEvent('team-1', 'event-1', {
        status: 'cancelled',
        updatedBy: 'admin-1'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    try {
      await service.updateEvent('team-1', 'event-1', {
        status: 'cancelled',
        updatedBy: 'admin-1'
      });
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN
        }
      });
    }
  });
});
