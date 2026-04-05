import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
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

describe('RecordsService', () => {
  const attendanceService = {
    listUserRecords: vi.fn()
  };
  const usersService = {
    findById: vi.fn()
  };

  let service: RecordsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RecordsService(attendanceService as any, usersService as any);
  });

  it('rejects cross-team member record access', async () => {
    usersService.findById.mockResolvedValue({
      id: 'user-2',
      teamId: 'team-2'
    });

    await expect(service.listMemberRecords(currentUser, 'user-2', undefined, 1, 20)).rejects.toMatchObject({
      response: {
        code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN
      }
    });
  });

  it('returns paginated member records for same-team users', async () => {
    const rows = [{ id: 'session-1' }];
    usersService.findById.mockResolvedValue({
      id: 'user-2',
      teamId: 'team-1'
    });
    attendanceService.listUserRecords.mockResolvedValue(rows);

    const result = await service.listMemberRecords(currentUser, 'user-2', '2026-03-30', 2, 10);

    expect(attendanceService.listUserRecords).toHaveBeenCalledWith('user-2', { weekKey: '2026-03-30' }, { page: 2, pageSize: 10 });
    expect(result).toBe(rows);
  });
});
