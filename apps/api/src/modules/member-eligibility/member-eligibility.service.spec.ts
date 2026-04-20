import { ForbiddenException } from '@nestjs/common';
import { ERROR_CODES } from '@lecpunch/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberEligibilityService } from './member-eligibility.service';

const create = vi.fn();
const find = vi.fn();
const findById = vi.fn();
const findOne = vi.fn();
const findOneAndDelete = vi.fn();
const findOneAndUpdate = vi.fn();

const createService = () =>
  new MemberEligibilityService({
    create,
    find,
    findById,
    findOne,
    findOneAndDelete,
    findOneAndUpdate
  } as any);

describe('MemberEligibilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows registration when student ID exists, name matches, and status is allowed', async () => {
    findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        id: 'entry-1',
        teamId: 'team-1',
        studentId: '20240001',
        realName: 'Alice',
        status: 'allowed'
      })
    });

    const service = createService();
    await expect(service.assertEligible('team-1', '20240001', 'Alice')).resolves.toMatchObject({
      teamId: 'team-1',
      studentId: '20240001'
    });
  });

  it('rejects registration when student ID does not exist in team eligibility', async () => {
    findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null)
    });

    const service = createService();
    await expect(service.assertEligible('team-1', '20240001', 'Alice')).rejects.toBeInstanceOf(ForbiddenException);

    try {
      await service.assertEligible('team-1', '20240001', 'Alice');
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: ERROR_CODES.AUTH_REGISTRATION_NOT_ELIGIBLE
        }
      });
    }
  });

  it('rejects registration when student ID exists but real name does not match', async () => {
    findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        id: 'entry-1',
        teamId: 'team-1',
        studentId: '20240001',
        realName: 'Alice',
        status: 'allowed'
      })
    });

    const service = createService();
    await expect(service.assertEligible('team-1', '20240001', 'Bob')).rejects.toBeInstanceOf(ForbiddenException);

    try {
      await service.assertEligible('team-1', '20240001', 'Bob');
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: ERROR_CODES.AUTH_REGISTRATION_REALNAME_MISMATCH
        }
      });
    }
  });

  it('rejects registration when student ID is blocked', async () => {
    findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        id: 'entry-1',
        teamId: 'team-1',
        studentId: '20240001',
        realName: 'Alice',
        status: 'blocked'
      })
    });

    const service = createService();
    await expect(service.assertEligible('team-1', '20240001', 'Alice')).rejects.toBeInstanceOf(ForbiddenException);

    try {
      await service.assertEligible('team-1', '20240001', 'Alice');
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: ERROR_CODES.AUTH_REGISTRATION_STUDENT_ID_BLOCKED
        }
      });
    }
  });

  it('rejects cross-team updates', async () => {
    findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        id: 'entry-2',
        teamId: 'team-2',
        studentId: '20240002',
        realName: 'Bob',
        status: 'allowed'
      })
    });

    const service = createService();
    await expect(service.updateEntry('team-1', 'entry-2', { status: 'blocked' })).rejects.toBeInstanceOf(
      ForbiddenException
    );

    try {
      await service.updateEntry('team-1', 'entry-2', { status: 'blocked' });
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN
        }
      });
    }
  });
});
