import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { NetworkPolicyController } from './network-policy.controller';
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

describe('NetworkPolicyController', () => {
  const networkPolicyService = {
    getAdminPolicy: vi.fn(),
    updateAdminPolicy: vi.fn()
  };

  let controller: NetworkPolicyController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new NetworkPolicyController(networkPolicyService as never);
  });

  it('returns the current admin policy with serialized dates', async () => {
    networkPolicyService.getAdminPolicy.mockResolvedValue({
      teamId: 'team-1',
      source: 'database',
      allowAnyNetwork: false,
      allowedPublicIps: ['203.0.113.10'],
      allowedCidrs: ['192.168.0.0/16'],
      trustProxy: true,
      trustedProxyHops: 2,
      updatedAt: new Date('2026-04-11T00:00:00.000Z')
    });

    const result = await controller.getCurrentPolicy(adminUser);

    expect(networkPolicyService.getAdminPolicy).toHaveBeenCalledWith('team-1');
    expect(result).toEqual({
      teamId: 'team-1',
      source: 'database',
      allowAnyNetwork: false,
      allowedPublicIps: ['203.0.113.10'],
      allowedCidrs: ['192.168.0.0/16'],
      trustProxy: true,
      trustedProxyHops: 2,
      updatedAt: '2026-04-11T00:00:00.000Z'
    });
  });

  it('updates the current admin policy for admins only', async () => {
    const input = {
      allowAnyNetwork: false,
      allowedPublicIps: ['203.0.113.10'],
      allowedCidrs: [],
      trustProxy: false,
      trustedProxyHops: 1
    };

    networkPolicyService.updateAdminPolicy.mockResolvedValue({
      teamId: 'team-1',
      source: 'database',
      updatedAt: new Date('2026-04-11T00:00:00.000Z'),
      ...input
    });

    await controller.updateCurrentPolicy(adminUser, input);

    expect(networkPolicyService.updateAdminPolicy).toHaveBeenCalledWith('team-1', input);
  });

  it('rejects member access to admin network policy routes', async () => {
    await expect(controller.getCurrentPolicy(memberUser)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.updateCurrentPolicy(memberUser, {
        allowAnyNetwork: true,
        allowedPublicIps: [],
        allowedCidrs: [],
        trustProxy: false,
        trustedProxyHops: 1
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
