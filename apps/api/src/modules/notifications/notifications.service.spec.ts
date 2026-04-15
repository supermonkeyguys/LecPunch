import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const create = vi.fn();
  const find = vi.fn();
  const findOne = vi.fn();
  const notificationModel = {
    create,
    find,
    findOne
  } as any;

  let service: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationsService(notificationModel);
  });

  it('creates attendance-record-marked notifications with the expected payload shape', async () => {
    create.mockResolvedValue({
      id: 'notification-1',
      teamId: 'team-1',
      userId: 'user-1',
      type: 'attendance.record_marked',
      title: '打卡记录已被标记',
      message: '管理员标记了一条你的打卡记录，请进入记录页查看详情。',
      payload: {
        recordId: 'session-1',
        memberKey: 'member-key-user-1',
        weekKey: '2026-04-06'
      },
      sourceType: 'attendance_record',
      sourceId: 'session-1',
      createdBy: 'admin-1',
      createdAt: new Date('2026-04-16T00:00:00.000Z'),
      acknowledgedAt: null
    });

    const result = await service.createForAttendanceRecordMarked({
      teamId: 'team-1',
      userId: 'user-1',
      sourceId: 'session-1',
      memberKey: 'member-key-user-1',
      weekKey: '2026-04-06',
      createdBy: 'admin-1'
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        userId: 'user-1',
        type: 'attendance.record_marked',
        sourceType: 'attendance_record',
        sourceId: 'session-1',
        acknowledgedAt: null
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'notification-1',
        payload: {
          recordId: 'session-1',
          memberKey: 'member-key-user-1',
          weekKey: '2026-04-06'
        }
      })
    );
  });

  it('lists unacknowledged notifications by default', async () => {
    const exec = vi.fn().mockResolvedValue([
      {
        id: 'notification-1',
        teamId: 'team-1',
        userId: 'user-1',
        type: 'attendance.record_marked',
        title: 'title',
        message: 'message',
        payload: { recordId: 'session-1', memberKey: 'member-key-user-1', weekKey: '2026-04-06' },
        sourceType: 'attendance_record',
        sourceId: 'session-1',
        createdBy: 'admin-1',
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        acknowledgedAt: null
      }
    ]);
    const limit = vi.fn().mockReturnValue({ exec });
    const sort = vi.fn().mockReturnValue({ limit });
    find.mockReturnValue({ sort });

    const result = await service.listForUser('team-1', 'user-1');

    expect(find).toHaveBeenCalledWith({ teamId: 'team-1', userId: 'user-1', acknowledgedAt: null });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(20);
    expect(result).toHaveLength(1);
  });

  it('acknowledges notifications idempotently for the owning user', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    findOne.mockReturnValueOnce({
      exec: vi.fn().mockResolvedValue({
        id: 'notification-1',
        teamId: 'team-1',
        userId: 'user-1',
        type: 'attendance.record_marked',
        title: 'title',
        message: 'message',
        payload: { recordId: 'session-1', memberKey: 'member-key-user-1', weekKey: '2026-04-06' },
        sourceType: 'attendance_record',
        sourceId: 'session-1',
        createdBy: 'admin-1',
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        acknowledgedAt: null,
        save
      })
    });

    const result = await service.acknowledge('team-1', 'user-1', 'notification-1');

    expect(findOne).toHaveBeenCalledWith({ _id: 'notification-1', teamId: 'team-1', userId: 'user-1' });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.acknowledgedAt).not.toBeNull();
  });

  it('keeps repeated acknowledgements idempotent', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    findOne.mockReturnValueOnce({
      exec: vi.fn().mockResolvedValue({
        id: 'notification-1',
        teamId: 'team-1',
        userId: 'user-1',
        type: 'attendance.record_marked',
        title: 'title',
        message: 'message',
        payload: { recordId: 'session-1', memberKey: 'member-key-user-1', weekKey: '2026-04-06' },
        sourceType: 'attendance_record',
        sourceId: 'session-1',
        createdBy: 'admin-1',
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        acknowledgedAt: new Date('2026-04-16T01:00:00.000Z'),
        save
      })
    });

    const result = await service.acknowledge('team-1', 'user-1', 'notification-1');

    expect(save).not.toHaveBeenCalled();
    expect(result.acknowledgedAt).toBe('2026-04-16T01:00:00.000Z');
  });

  it('rejects acknowledgement for notifications outside the current user scope', async () => {
    findOne.mockReturnValueOnce({
      exec: vi.fn().mockResolvedValue(null)
    });

    await expect(service.acknowledge('team-1', 'user-1', 'notification-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
