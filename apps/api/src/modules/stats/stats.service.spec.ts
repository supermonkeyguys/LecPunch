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
    attendanceService.getModel.mockReturnValue({ aggregate });
    service = new StatsService(attendanceService as any, usersService as any);
  });

  it('returns team current week stats enriched with role and display name', async () => {
    aggregate.mockReturnValue({
      exec: vi.fn().mockResolvedValue([
        { _id: 'user-1', totalDurationSeconds: 7200, sessionsCount: 2 }
      ])
    });
    usersService.findByIds.mockResolvedValue([
      { id: 'user-1', displayName: 'Alice', role: 'member' }
    ]);

    const result = await service.getTeamCurrentWeekStats('team-1');

    expect(result).toEqual([
      {
        userId: 'user-1',
        totalDurationSeconds: 7200,
        sessionsCount: 2,
        displayName: 'Alice',
        role: 'member',
        weekKey: expect.any(String)
      }
    ]);
  });
});
