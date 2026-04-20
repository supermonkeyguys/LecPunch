import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { MemberEligibilityController } from './member-eligibility.controller';
import type { AuthUser } from '../auth/types/auth-user.type';

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

describe('MemberEligibilityController', () => {
  const memberEligibilityService = {
    listEntries: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn()
  };

  let controller: MemberEligibilityController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new MemberEligibilityController(memberEligibilityService as never);
  });

  it('lists admin entries scoped by team and query', async () => {
    memberEligibilityService.listEntries.mockResolvedValue([
      {
        id: 'entry-1',
        teamId: 'team-1',
        studentId: '202400000001',
        realName: 'Alice',
        status: 'allowed',
        note: 'ok',
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T00:00:00.000Z'),
        internalField: 'hidden'
      }
    ]);

    const result = await controller.listEntries(adminUser, {
      keyword: 'Alice',
      status: 'allowed',
      limit: 20
    });

    expect(memberEligibilityService.listEntries).toHaveBeenCalledWith('team-1', {
      keyword: 'Alice',
      status: 'allowed',
      limit: 20
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'entry-1',
          teamId: 'team-1',
          studentId: '202400000001',
          realName: 'Alice'
        })
      ]
    });
    expect(result.items[0]).not.toHaveProperty('internalField');
  });

  it('creates, updates, and deletes entries for admins', async () => {
    memberEligibilityService.createEntry.mockResolvedValue({
      id: 'entry-1',
      teamId: 'team-1',
      studentId: '202400000001',
      realName: 'Alice',
      status: 'allowed'
    });
    memberEligibilityService.updateEntry.mockResolvedValue({
      id: 'entry-1',
      teamId: 'team-1',
      studentId: '202400000001',
      realName: 'Alice',
      status: 'blocked'
    });

    await controller.createEntry(adminUser, {
      studentId: '202400000001',
      realName: 'Alice',
      status: 'allowed'
    });
    await controller.updateEntry(adminUser, 'entry-1', { status: 'blocked' });
    await controller.deleteEntry(adminUser, 'entry-1');

    expect(memberEligibilityService.createEntry).toHaveBeenCalledWith({
      teamId: 'team-1',
      studentId: '202400000001',
      realName: 'Alice',
      status: 'allowed',
      note: undefined
    });
    expect(memberEligibilityService.updateEntry).toHaveBeenCalledWith('team-1', 'entry-1', { status: 'blocked' });
    expect(memberEligibilityService.deleteEntry).toHaveBeenCalledWith('team-1', 'entry-1');
  });

  it('rejects member access to admin entry routes', async () => {
    await expect(controller.listEntries(memberUser, { limit: 20 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.createEntry(memberUser, {
        studentId: '202400000001',
        realName: 'Alice'
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.updateEntry(memberUser, 'entry-1', {
        status: 'blocked'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.deleteEntry(memberUser, 'entry-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
