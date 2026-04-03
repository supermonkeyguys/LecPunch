import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoSeedService } from './demo-seed.service';

const bcrypt = vi.hoisted(() => ({
  hash: vi.fn()
}));

vi.mock('bcrypt', () => bcrypt);

describe('DemoSeedService', () => {
  const usersService = {
    findByUsername: vi.fn(),
    create: vi.fn()
  };
  const teamsService = {
    ensureDefaultTeam: vi.fn()
  };

  let service: DemoSeedService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DemoSeedService(usersService as any, teamsService as any);
  });

  it('creates demo users when they do not exist yet', async () => {
    teamsService.ensureDefaultTeam.mockResolvedValue({ id: 'team-1', name: 'FocusTeam' });
    usersService.findByUsername.mockResolvedValue(null);
    usersService.create.mockResolvedValue(undefined);
    bcrypt.hash.mockResolvedValue('hashed-password');

    const result = await service.seed();

    expect(result.teamName).toBe('FocusTeam');
    expect(result.createdUsers).toEqual(['demo-admin', 'demo-member']);
    expect(usersService.create).toHaveBeenCalledTimes(2);
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'demo-admin', role: 'admin', teamId: 'team-1' })
    );
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'demo-member', role: 'member', teamId: 'team-1' })
    );
  });
});
