import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SKIN_PRICE_POINTS } from './shop.constants';
import { ShopService } from './shop.service';

const user = { userId: 'user-1', teamId: 'team-1', role: 'member' } as any;
const unlockedAt = new Date('2026-09-06T08:00:00.000Z');

function query<T>(value: T) {
  return { exec: vi.fn().mockResolvedValue(value) };
}

describe('ShopService', () => {
  const skinUnlockModel = {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn()
  };
  const pointsService = {
    getUserPoints: vi.fn(),
    findSkinUnlockExpense: vi.fn(),
    recordSkinUnlockExpense: vi.fn()
  };
  let service: ShopService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ShopService(skinUnlockModel as any, pointsService as any);
  });

  it('returns only the authenticated member’s unlocked skin ids in deterministic order', async () => {
    skinUnlockModel.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockReturnValue(query([{ skinId: 'doro' }, { skinId: 'white-cat' }])) })
    });

    await expect(service.getUnlocks(user)).resolves.toEqual({ skinIds: ['doro', 'white-cat'] });
    expect(skinUnlockModel.find).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('writes one negative ledger expense and one unlock for a new purchase', async () => {
    skinUnlockModel.findOne.mockReturnValue(query(null));
    pointsService.findSkinUnlockExpense.mockResolvedValue(null);
    pointsService.getUserPoints
      .mockResolvedValueOnce({ totalPoints: 650 })
      .mockResolvedValueOnce({ totalPoints: 50 });
    pointsService.recordSkinUnlockExpense.mockResolvedValue(undefined);
    skinUnlockModel.findOneAndUpdate.mockReturnValue(query({ skinId: 'doro', unlockedAt }));

    await expect(service.unlock(user, 'doro')).resolves.toEqual({
      skinId: 'doro',
      unlockedAt: unlockedAt.toISOString(),
      alreadyUnlocked: false,
      pricePoints: SKIN_PRICE_POINTS,
      totalPoints: 50
    });
    expect(pointsService.recordSkinUnlockExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        userId: 'user-1',
        skinId: 'doro'
      })
    );
    expect(skinUnlockModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1', skinId: 'doro' },
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ userId: 'user-1', skinId: 'doro' }) }),
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  });

  it('is idempotent for an already unlocked skin and never writes another expense', async () => {
    skinUnlockModel.findOne.mockReturnValue(query({ skinId: 'doro', unlockedAt }));
    pointsService.getUserPoints.mockResolvedValue({ totalPoints: 50 });

    await expect(service.unlock(user, 'doro')).resolves.toMatchObject({
      skinId: 'doro',
      alreadyUnlocked: true,
      totalPoints: 50
    });
    expect(pointsService.recordSkinUnlockExpense).not.toHaveBeenCalled();
  });

  it('rejects an insufficient balance with the explicit shop error code', async () => {
    skinUnlockModel.findOne.mockReturnValue(query(null));
    pointsService.findSkinUnlockExpense.mockResolvedValue(null);
    pointsService.getUserPoints.mockResolvedValue({ totalPoints: 599 });

    await expect(service.unlock(user, 'doro')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SHOP_INSUFFICIENT_POINTS', requiredPoints: SKIN_PRICE_POINTS })
    });
    expect(pointsService.recordSkinUnlockExpense).not.toHaveBeenCalled();
  });

  it('repairs an interrupted purchase that has an existing expense but no unlock without a second charge', async () => {
    skinUnlockModel.findOne.mockReturnValue(query(null));
    pointsService.findSkinUnlockExpense.mockResolvedValue({ sourceAttendanceSessionId: 'skin_unlock:user-1:doro' });
    skinUnlockModel.findOneAndUpdate.mockReturnValue(query({ skinId: 'doro', unlockedAt }));
    pointsService.getUserPoints.mockResolvedValue({ totalPoints: 50 });

    await expect(service.unlock(user, 'doro')).resolves.toMatchObject({ skinId: 'doro', alreadyUnlocked: true });
    expect(pointsService.recordSkinUnlockExpense).not.toHaveBeenCalled();
  });
});
