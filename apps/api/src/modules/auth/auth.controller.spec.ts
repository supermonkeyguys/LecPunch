import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
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

  it('delegates login requests to AuthService', async () => {
    authService.login.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'user-1' }
    });

    const payload = { username: 'demo-member', password: '123456' } as any;
    const result = await controller.login(payload);

    expect(authService.login).toHaveBeenCalledWith(payload);
    expect(result).toEqual({
      accessToken: 'token',
      user: { id: 'user-1' }
    });
  });
});
