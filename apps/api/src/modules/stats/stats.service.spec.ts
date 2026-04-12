import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StatsService } from './stats.service';

describe('StatsService', () => {
  const aggregate = vi.fn();
  const attendanceService = {
    getModel: vi.fn()
  };
  const usersService = {
    findById: vi.fn(),
    findByIds: vi.fn()
  };

  let service: StatsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    attendanceService.getModel.mockReturnValue({ aggregate });
    service = new StatsService(attendanceService as any, usersService as any);
  });

  it('returns team current week stats enriched with member profile fields', async () => {
    aggregate.mockReturnValue({
      exec: vi.fn().mockResolvedValue([
        { _id: 'user-1', totalDurationSeconds: 7200, sessionsCount: 2 }
      ])
    });
    usersService.findByIds.mockResolvedValue([{ id: 'user-1', displayName: 'Alice', role: 'member', enrollYear: 2024 }]);

    const result = await service.getTeamCurrentWeekStats('team-1');

    expect(result).toEqual([
      {
        userId: 'user-1',
        totalDurationSeconds: 7200,
        sessionsCount: 2,
        displayName: 'Alice',
        role: 'member',
        enrollYear: 2024,
        weekKey: expect.any(String)
      }
    ]);
  });

  it('matches the current week using Asia/Shanghai boundaries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-05T16:30:00.000Z'));
    aggregate.mockReturnValue({
      exec: vi.fn().mockResolvedValue([])
    });
    usersService.findByIds.mockResolvedValue([]);

    await service.getTeamCurrentWeekStats('team-1');

    expect(aggregate).toHaveBeenCalledWith([
      {
        $match: {
          teamId: 'team-1',
          weekKey: '2026-04-06',
          status: { $ne: 'active' }
        }
      },
      {
        $group: {
          _id: '$userId',
          totalDurationSeconds: { $sum: '$durationSeconds' },
          sessionsCount: { $sum: 1 }
        }
      },
      { $sort: { totalDurationSeconds: -1 } }
    ]);
  });

  it('maps aggregated weekly rows to the shared weekKey contract', async () => {
    aggregate.mockReturnValue({
      exec: vi.fn().mockResolvedValue([{ _id: '2026-04-07', totalDurationSeconds: 5400, sessionsCount: 3 }])
    });

    const result = await service.getMyWeeklyStats('user-1');

    expect(result).toEqual([{ weekKey: '2026-04-07', totalDurationSeconds: 5400, sessionsCount: 3 }]);
  });
});
