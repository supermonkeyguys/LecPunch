import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RecordsService } from './records.service';
import { ERROR_CODES } from '@lecpunch/shared';
import type { AuthUser } from '../auth/types/auth-user.type';

const currentUser: AuthUser = {
  userId: 'user-1',
  teamId: 'team-1',
  role: 'member',
  username: 'alice',
  displayName: 'Alice',
  enrollYear: 2024
};

const adminUser: AuthUser = {
  ...currentUser,
  userId: 'admin-1',
  role: 'admin',
  username: 'admin',
  displayName: 'Admin'
};

describe('RecordsService', () => {
  const attendanceService = {
    listUserRecords: vi.fn(),
    listTeamRecords: vi.fn(),
    setTeamRecordMarked: vi.fn(),
    deleteCompletedTeamRecord: vi.fn()
  };
  const usersService = {
    findById: vi.fn(),
    findByMemberKey: vi.fn(),
    listTeamMembers: vi.fn()
  };

  let service: RecordsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RecordsService(attendanceService as any, usersService as any);
  });

  it('rejects cross-team member record access', async () => {
    usersService.findByMemberKey.mockResolvedValue({
      id: 'user-2',
      teamId: 'team-2'
    });

    await expect(service.listMemberRecords(currentUser, 'member-key-2', undefined, 1, 20)).rejects.toMatchObject({
      response: {
        code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN
      }
    });
  });

  it('returns paginated member records for same-team users', async () => {
    const rows = [{ id: 'session-1' }];
    const filters = { weekKey: '2026-03-30' };
    usersService.findByMemberKey.mockResolvedValue({
      id: 'user-2',
      teamId: 'team-1'
    });
    attendanceService.listUserRecords.mockResolvedValue(rows);

    const result = await service.listMemberRecords(currentUser, 'member-key-2', filters, 2, 10);

    expect(attendanceService.listUserRecords).toHaveBeenCalledWith('user-2', filters, { page: 2, pageSize: 10 });
    expect(result).toBe(rows);
  });

  it('rejects non-admin team record export requests', async () => {
    await expect(service.exportTeamRecords(currentUser, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates marked state for admins only', async () => {
    const record = { id: 'session-1', isMarked: true };
    attendanceService.setTeamRecordMarked.mockResolvedValue(record);

    await expect(service.adminUpdateRecordMark(currentUser, 'session-1', true)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.adminUpdateRecordMark(adminUser, 'session-1', true)).resolves.toBe(record);

    expect(attendanceService.setTeamRecordMarked).toHaveBeenCalledWith('team-1', 'session-1', true);
  });

  it('deletes records for admins only', async () => {
    await expect(service.adminDeleteRecord(currentUser, 'session-1')).rejects.toBeInstanceOf(ForbiddenException);

    await service.adminDeleteRecord(adminUser, 'session-1');

    expect(attendanceService.deleteCompletedTeamRecord).toHaveBeenCalledWith('team-1', 'session-1');
  });

  it('exports team records with member metadata for admins', async () => {
    attendanceService.listTeamRecords.mockResolvedValue([
      {
        id: 'session-1',
        teamId: 'team-1',
        userId: 'user-2',
        weekKey: '2026-04-06',
        checkInAt: new Date('2026-04-09T01:00:00.000Z'),
        checkOutAt: new Date('2026-04-09T03:00:00.000Z'),
        durationSeconds: 7200,
        status: 'completed',
        isMarked: false
      }
    ]);
    usersService.listTeamMembers.mockResolvedValue([
      {
        id: 'user-2',
        username: 'alice',
        displayName: 'Alice',
        realName: 'Alice Chen',
        studentId: '20240001',
        enrollYear: 2024
      }
    ]);

    const result = await service.exportTeamRecords(adminUser, { startDate: '2026-04-09', endDate: '2026-04-09' });

    expect(attendanceService.listTeamRecords).toHaveBeenCalledWith('team-1', {
      startDate: '2026-04-09',
      endDate: '2026-04-09'
    });
    expect(usersService.listTeamMembers).toHaveBeenCalledWith('team-1');
    expect(result).toEqual([
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
        invalidReason: undefined
      }
    ]);
  });
});
