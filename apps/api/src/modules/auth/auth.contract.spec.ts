import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';

describe('AuthController contract', () => {
  const authService = {
    login: vi.fn(),
    register: vi.fn(),
    getProfile: vi.fn()
  };

  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(authService as any);
  });

  it('returns a consistent auth/me response shape', async () => {
    authService.getProfile.mockResolvedValue({
      id: 'user-1',
      username: 'demo-member',
      displayName: 'Demo Member',
      teamId: 'team-1',
      role: 'member',
      status: 'active'
    });

    const result = await controller.me({ userId: 'user-1' } as any);

    expect(result).toMatchObject({
      id: 'user-1',
      username: 'demo-member',
      displayName: 'Demo Member',
      teamId: 'team-1',
      role: 'member',
      status: 'active'
    });
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('updatedAt');
  });
});
