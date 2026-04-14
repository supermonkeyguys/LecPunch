import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordsController } from './records.controller';

describe('RecordsController', () => {
  const recordsService = {
    listMyRecords: vi.fn(),
    listMemberRecords: vi.fn(),
    adminUpdateRecordMark: vi.fn(),
    adminDeleteRecord: vi.fn(),
    exportTeamRecords: vi.fn()
  };

  let controller: RecordsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new RecordsController(recordsService as any);
  });

  it('maps member records without leaking user or team ids', async () => {
    recordsService.listMemberRecords.mockResolvedValue([
      {
        id: 'session-1',
        userId: 'user-2',
        teamId: 'team-1',
        checkInAt: new Date('2026-04-09T01:00:00.000Z'),
        checkOutAt: new Date('2026-04-09T03:00:00.000Z'),
        durationSeconds: 7200,
        status: 'completed',
        invalidReason: undefined,
        isMarked: true,
        weekKey: '2026-04-06'
      }
    ]);

    const result = await controller.memberRecords(
      { userId: 'user-1', teamId: 'team-1', role: 'member' } as any,
      'member-key-2'
    );

    expect(recordsService.listMemberRecords).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', teamId: 'team-1' }),
      'member-key-2',
      { weekKey: undefined, startDate: undefined, endDate: undefined },
      1,
      20
    );
    expect(result.items).toEqual([
      {
        id: 'session-1',
        checkInAt: new Date('2026-04-09T01:00:00.000Z'),
        checkOutAt: new Date('2026-04-09T03:00:00.000Z'),
        durationSeconds: 7200,
        status: 'completed',
        invalidReason: undefined,
        isMarked: true,
        weekKey: '2026-04-06'
      }
    ]);
    expect(result.items[0]).not.toHaveProperty('userId');
    expect(result.items[0]).not.toHaveProperty('teamId');
  });

  it('updates admin record mark state and maps the session shape', async () => {
    recordsService.adminUpdateRecordMark.mockResolvedValue({
      id: 'session-1',
      checkInAt: new Date('2026-04-09T01:00:00.000Z'),
      checkOutAt: new Date('2026-04-09T03:00:00.000Z'),
      durationSeconds: 7200,
      status: 'completed',
      invalidReason: undefined,
      isMarked: true,
      weekKey: '2026-04-06'
    });

    const result = await controller.adminUpdateRecordMark(
      { userId: 'admin-1', teamId: 'team-1', role: 'admin' } as any,
      'session-1',
      { isMarked: true }
    );

    expect(recordsService.adminUpdateRecordMark).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1', teamId: 'team-1' }),
      'session-1',
      true
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'session-1',
        isMarked: true,
        weekKey: '2026-04-06'
      })
    );
  });

  it('deletes admin records through the service', async () => {
    await expect(
      controller.adminDeleteRecord({ userId: 'admin-1', teamId: 'team-1', role: 'admin' } as any, 'session-1')
    ).resolves.toEqual({ success: true });

    expect(recordsService.adminDeleteRecord).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1', teamId: 'team-1' }),
      'session-1'
    );
  });

  it('exports CSV with attachment headers for admins', async () => {
    recordsService.exportTeamRecords.mockResolvedValue([
      {
        sessionId: 'session-1',
        weekKey: '2026-04-06',
        userId: 'user-2',
        username: 'alice',
        displayName: 'Alice',
        realName: 'Alice Chen',
        studentId: '20240001',
        enrollYear: 2024,
        checkInAt: new Date('2026-04-09T01:00:00.000Z'),
        checkOutAt: new Date('2026-04-09T03:00:00.000Z'),
        durationSeconds: 7200,
        status: 'completed',
        invalidReason: undefined,
        isMarked: false
      }
    ]);

    const response = {
      setHeader: vi.fn()
    } as any;

    const result = await controller.exportTeamRecords(
      { userId: 'admin-1', teamId: 'team-1', role: 'admin' } as any,
      response,
      '2026-04-06'
    );

    expect(recordsService.exportTeamRecords).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1', teamId: 'team-1' }),
      { weekKey: '2026-04-06', startDate: undefined, endDate: undefined }
    );
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="team-records-2026-04-06.csv"'
    );
    expect(result).toContain('记录ID');
    expect(result).toContain('Alice');
    expect(result.startsWith('\uFEFF')).toBe(true);
  });
});
