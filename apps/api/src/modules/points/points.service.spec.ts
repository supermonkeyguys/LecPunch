import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PointsService } from './points.service';
import { SKIN_PRICE_POINTS } from '../../common/constants/shop.constants';

describe('PointsService', () => {
  const findOneAndUpdate = vi.fn();
  const aggregate = vi.fn();
  const pointLedgerModel = { findOneAndUpdate, aggregate } as any;
  let service: PointsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PointsService(pointLedgerModel);
  });

  it('awards one point for each fully completed attendance minute', async () => {
    findOneAndUpdate.mockReturnValue({ exec: vi.fn().mockResolvedValue({}) });

    await expect(
      service.syncAttendancePoints({
        teamId: 'team-1',
        userId: 'user-1',
        attendanceSessionId: 'session-1',
        weekKey: '2026-04-06',
        durationSeconds: 179,
        isValid: true
      })
    ).resolves.toBe(2);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { sourceAttendanceSessionId: 'session-1' },
      {
        $set: {
          teamId: 'team-1',
          userId: 'user-1',
          weekKey: '2026-04-06',
          sourceType: 'attendance',
          points: 2
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  });

  it('sets an invalidated attendance session to zero points', async () => {
    findOneAndUpdate.mockReturnValue({ exec: vi.fn().mockResolvedValue({}) });

    await expect(
      service.syncAttendancePoints({
        teamId: 'team-1',
        userId: 'user-1',
        attendanceSessionId: 'session-1',
        weekKey: '2026-04-06',
        durationSeconds: 300,
        isValid: false
      })
    ).resolves.toBe(0);

    expect(findOneAndUpdate.mock.calls[0][1].$set.points).toBe(0);
  });

  it('keeps the authenticated points endpoint compatible with all-time and ISO-week totals', async () => {
    aggregate
      .mockReturnValueOnce({ exec: vi.fn().mockResolvedValue([{ totalPoints: 60 }]) })
      .mockReturnValueOnce({ exec: vi.fn().mockResolvedValue([{ totalPoints: 20 }]) });

    await expect(service.getMyPoints({ userId: 'user-1', teamId: 'team-1' } as any, '2026-W15')).resolves.toMatchObject({
      totalPoints: 60,
      week: '2026-W15',
      weekPoints: 20,
      accrualRate: { focusedMinutes: 1, points: 1 }
    });
    expect(aggregate).toHaveBeenNthCalledWith(2, [
      { $match: { teamId: 'team-1', userId: 'user-1', weekKey: '2026-04-06' } },
      { $group: { _id: null, totalPoints: { $sum: '$points' } } }
    ]);
  });

  it('returns zero when a user has no point ledger entries', async () => {
    aggregate.mockReturnValue({ exec: vi.fn().mockResolvedValue([]) });

    await expect(service.getUserPoints('team-1', 'user-1')).resolves.toEqual({ totalPoints: 0 });
    expect(aggregate).toHaveBeenCalledWith([
      { $match: { teamId: 'team-1', userId: 'user-1' } },
      { $group: { _id: null, totalPoints: { $sum: '$points' } } }
    ]);
  });

  it('uses the same signed ledger sum for a skin expense as for attendance income', async () => {
    aggregate.mockReturnValue({ exec: vi.fn().mockResolvedValue([{ totalPoints: 40 }]) });

    await expect(service.getUserPoints('team-1', 'user-1')).resolves.toEqual({ totalPoints: 40 });
    expect(aggregate).toHaveBeenCalledWith([
      { $match: { teamId: 'team-1', userId: 'user-1' } },
      { $group: { _id: null, totalPoints: { $sum: '$points' } } }
    ]);
  });

  it('records a skin unlock as one negative, idempotency-addressable ledger expense', async () => {
    findOneAndUpdate.mockReturnValue({ exec: vi.fn().mockResolvedValue({}) });
    const create = vi.fn().mockResolvedValue({});
    pointLedgerModel.create = create;

    await service.recordSkinUnlockExpense({ teamId: 'team-1', userId: 'user-1', skinId: 'doro' });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        userId: 'user-1',
        sourceType: 'skin_unlock',
        sourceAttendanceSessionId: 'skin_unlock:user-1:doro',
        points: -SKIN_PRICE_POINTS
      })
    );
  });
});
