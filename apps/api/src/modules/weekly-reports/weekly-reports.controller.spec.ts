import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { WeeklyReportsController } from './weekly-reports.controller';

describe('WeeklyReportsController', () => {
  const weeklyReportsService = { getMine: vi.fn(), upsertMine: vi.fn(), listForAdmin: vi.fn() };
  let controller: WeeklyReportsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new WeeklyReportsController(weeklyReportsService as any);
  });

  it('uses the JWT user for member reads and writes', async () => {
    const user = { userId: 'user-1', teamId: 'team-1', role: 'member' } as any;
    weeklyReportsService.getMine.mockResolvedValue({ week: '2026-W36', item: null });
    weeklyReportsService.upsertMine.mockResolvedValue({ week: '2026-W36', item: { status: 'pending' } });

    await controller.getMine(user, { week: '2026-W36' });
    await controller.putMine(user, { week: '2026-W36' }, { status: 'pending' });

    expect(weeklyReportsService.getMine).toHaveBeenCalledWith(user, '2026-W36');
    expect(weeklyReportsService.upsertMine).toHaveBeenCalledWith(user, '2026-W36', { status: 'pending' });
  });

  it('allows only administrators to list team references', () => {
    expect(() => controller.getForAdmin({ role: 'member', teamId: 'team-1' } as any, { week: '2026-W36' })).toThrow(
      ForbiddenException
    );
    expect(weeklyReportsService.listForAdmin).not.toHaveBeenCalled();
  });
});
