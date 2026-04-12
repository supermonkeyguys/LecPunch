import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatsController } from './stats.controller';

describe('StatsController contract', () => {
  const statsService = {
    getMyWeeklyStats: vi.fn(),
    getTeamCurrentWeekStats: vi.fn(),
    getMemberWeeklyStats: vi.fn(),
    getWeeklyGoalSeconds: vi.fn().mockReturnValue(38 * 3600)
  };

  let controller: StatsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new StatsController(statsService as any);
  });

  it('returns weekly stats inside a stable items wrapper', async () => {
    statsService.getMyWeeklyStats.mockResolvedValue([
      { weekKey: '2026-03-31', totalDurationSeconds: 7200, sessionsCount: 2, weeklyGoalSeconds: 38 * 3600 }
    ]);

    const result = await controller.myWeeklyStats({ userId: 'user-1', enrollYear: 2024 } as any);

    expect(result).toMatchObject({
      items: [{ weekKey: '2026-03-31', totalDurationSeconds: 7200, sessionsCount: 2, weeklyGoalSeconds: 38 * 3600 }],
      weeklyGoalSeconds: 38 * 3600
    });
  });

  it('returns team current week stats without leaking member ids', async () => {
    statsService.getTeamCurrentWeekStats.mockResolvedValue([
      {
        displayName: 'Alice',
        role: 'member',
        enrollYear: 2024,
        totalDurationSeconds: 7200,
        sessionsCount: 2,
        weekKey: '2026-03-31'
      }
    ]);

    const result = await controller.teamCurrentWeek({ teamId: 'team-1', enrollYear: 2024 } as any);

    expect(result).toMatchObject({
      items: [
        {
          displayName: 'Alice',
          enrollYear: 2024,
          totalDurationSeconds: 7200,
          sessionsCount: 2,
          weekKey: '2026-03-31'
        }
      ]
    });
    expect(result.items[0]).not.toHaveProperty('userId');
  });

  it('returns member weekly stats with member info', async () => {
    statsService.getMemberWeeklyStats.mockResolvedValue({
      member: { id: 'user-2', displayName: 'Bob', role: 'member' },
      items: [{ weekKey: '2026-03-31', totalDurationSeconds: 3600, sessionsCount: 1, weeklyGoalSeconds: 28 * 3600 }]
    });

    const result = await controller.memberWeeklyStats({ teamId: 'team-1' } as any, 'user-2');

    expect(result).toMatchObject({
      member: { id: 'user-2', displayName: 'Bob' },
      items: expect.arrayContaining([expect.objectContaining({ weekKey: '2026-03-31' })])
    });
  });
});
