import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '@lecpunch/shared';
import { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';
import type { TeamsService } from '../teams/teams.service';
import type { MemberEligibilityService } from '../member-eligibility/member-eligibility.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn()
}));

const createUserRecord = () => ({
  id: 'user-1',
  username: 'demo-member',
  displayName: 'Demo Member',
  teamId: 'team-1',
  role: 'member',
  status: 'active',
  enrollYear: 2024,
  studentId: '202400000001',
  realName: 'Alice'
});

describe('AuthService register eligibility gate', () => {
  const usersService = {
    findByUsername: vi.fn(),
    findByStudentId: vi.fn(),
    create: vi.fn()
  } as unknown as UsersService;

  const teamsService = {
    ensureDefaultTeam: vi.fn()
  } as unknown as TeamsService;

  const memberEligibilityService = {
    assertEligible: vi.fn()
  } as unknown as MemberEligibilityService;

  const jwtService = {
    sign: vi.fn()
  } as unknown as JwtService;

  const configService = {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (key === 'ALLOW_OPEN_REGISTRATION') {
        return true;
      }
      if (key === 'DEFAULT_TEAM_NAME') {
        return defaultValue ?? 'FocusTeam';
      }
      return defaultValue;
    })
  } as unknown as ConfigService;

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(usersService, teamsService, memberEligibilityService, jwtService, configService);

    usersService.findByUsername.mockResolvedValue(null);
    usersService.findByStudentId.mockResolvedValue(null);
    teamsService.ensureDefaultTeam.mockResolvedValue({ id: 'team-1' });
    usersService.create.mockResolvedValue(createUserRecord());
    jwtService.sign.mockReturnValue('token');
    memberEligibilityService.assertEligible.mockResolvedValue(undefined);
  });

  it('registers successfully when student ID and real name are eligible', async () => {
    const result = await service.register({
      username: 'Demo-Member',
      password: '12345678',
      displayName: 'Demo Member',
      studentId: '202400000001',
      realName: 'Alice'
    });

    expect(memberEligibilityService.assertEligible).toHaveBeenCalledWith(
      'team-1',
      '202400000001',
      'Alice'
    );
    expect(usersService.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      accessToken: 'token',
      user: {
        id: 'user-1',
        username: 'demo-member',
        studentId: '202400000001',
        realName: 'Alice'
      }
    });
  });

  it('returns forbidden when student ID is not eligible', async () => {
    memberEligibilityService.assertEligible.mockRejectedValue(
      new ForbiddenException({
        code: ERROR_CODES.AUTH_REGISTRATION_NOT_ELIGIBLE,
        message: 'Student ID is not eligible for registration'
      })
    );

    await expect(
      service.register({
        username: 'demo-member',
        password: '12345678',
        displayName: 'Demo Member',
        studentId: '202400000001',
        realName: 'Alice'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('returns forbidden when student ID exists but real name mismatches', async () => {
    memberEligibilityService.assertEligible.mockRejectedValue(
      new ForbiddenException({
        code: ERROR_CODES.AUTH_REGISTRATION_REALNAME_MISMATCH,
        message: 'Real name does not match the eligibility record'
      })
    );

    await expect(
      service.register({
        username: 'demo-member',
        password: '12345678',
        displayName: 'Demo Member',
        studentId: '202400000001',
        realName: 'Alice'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('returns forbidden when student ID is blocked', async () => {
    memberEligibilityService.assertEligible.mockRejectedValue(
      new ForbiddenException({
        code: ERROR_CODES.AUTH_REGISTRATION_STUDENT_ID_BLOCKED,
        message: 'Student ID is blocked from registration'
      })
    );

    await expect(
      service.register({
        username: 'demo-member',
        password: '12345678',
        displayName: 'Demo Member',
        studentId: '202400000001',
        realName: 'Alice'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(usersService.create).not.toHaveBeenCalled();
  });
});
