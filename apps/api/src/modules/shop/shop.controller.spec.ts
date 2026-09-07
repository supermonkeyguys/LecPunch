import { GUARDS_METADATA } from '@nestjs/common/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopController } from './shop.controller';

describe('ShopController', () => {
  const shopService = { getUnlocks: vi.fn(), unlock: vi.fn() };
  let controller: ShopController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ShopController(shopService as any);
  });

  it('uses only the authenticated member when listing unlocks', async () => {
    const user = { userId: 'user-1', teamId: 'team-1' } as any;
    shopService.getUnlocks.mockResolvedValue({ skinIds: ['doro'] });

    await expect(controller.getUnlocks(user)).resolves.toEqual({ skinIds: ['doro'] });
    expect(shopService.getUnlocks).toHaveBeenCalledWith(user);
  });

  it('uses only the authenticated member and validated skin id when unlocking', async () => {
    const user = { userId: 'user-1', teamId: 'team-1' } as any;
    shopService.unlock.mockResolvedValue({ skinId: 'doro', alreadyUnlocked: false });

    await expect(controller.unlock(user, { skinId: 'doro' })).resolves.toMatchObject({ skinId: 'doro' });
    expect(shopService.unlock).toHaveBeenCalledWith(user, 'doro');
  });

  it('requires the normal JWT guard for both shop routes', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ShopController)).toContain(JwtAuthGuard);
  });
});
