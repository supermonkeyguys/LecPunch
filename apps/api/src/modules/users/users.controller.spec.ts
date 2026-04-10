import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';
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

describe('UsersController', () => {
  const usersService = {
    listTeamMembers: vi.fn(),
    adminUpdateMember: vi.fn(),
    updateProfile: vi.fn(),
    updatePassword: vi.fn()
  };

  let controller: UsersController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new UsersController(usersService as never);
  });

  it('lists team members for admins without exposing password hashes', async () => {
    usersService.listTeamMembers.mockResolvedValue([
      {
        id: 'member-2',
        teamId: 'team-1',
        username: 'alice',
        displayName: 'Alice',
        role: 'member',
        status: 'active',
        enrollYear: 2025,
        createdAt: new Date('2026-04-11T00:00:00.000Z'),
        updatedAt: new Date('2026-04-11T00:00:00.000Z'),
        passwordHash: 'secret'
      }
    ]);

    const result = await controller.listTeamMembers(adminUser);

    expect(usersService.listTeamMembers).toHaveBeenCalledWith('team-1');
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'member-2',
          username: 'alice',
          displayName: 'Alice'
        })
      ]
    });
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });

  it('rejects member access to admin member management routes', async () => {
    await expect(controller.listTeamMembers(memberUser)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.adminUpdateMember(memberUser, 'member-2', { role: 'admin' })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
