import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PointsController } from './points.controller';

describe('PointsController', () => {
  const pointsService = { getMyPoints: vi.fn() };
  let controller: PointsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new PointsController(pointsService as any);
  });

  it('uses the authenticated user and optional requested week only', async () => {
    const user = { userId: 'user-1', teamId: 'team-1', role: 'member' } as any;
    pointsService.getMyPoints.mockResolvedValue({ totalPoints: 60, weekPoints: 20 });

    await expect(controller.getMine(user, { week: '2026-W36' })).resolves.toEqual({ totalPoints: 60, weekPoints: 20 });
    expect(pointsService.getMyPoints).toHaveBeenCalledWith(user, '2026-W36');
  });
});
