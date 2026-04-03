import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatsController } from './stats.controller';

describe('StatsController contract', () => {
  const statsService = {
    getMyWeeklyStats: vi.fn(),
    getTeamCurrentWeekStats: vi.fn(),
    getMemberWeeklyStats: vi.fn()
  };

  let controller: StatsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new StatsController(statsService as any);
  });

  it('returns weekly stats inside a stable items wrapper', async () => {
    statsService.getMyWeeklyStats.mockResolvedValue([
      { weekKey: '2026-03-31', totalDurationSeconds: 7200, sessionsCount: 2 }
    ]);

    const result = await controller.myWeeklyStats({ userId: 'user-1' } as any);

    expect(result).toEqual({
      items: [{ weekKey: '2026-03-31', totalDurationSeconds: 7200, sessionsCount: 2 }]
    });
  });
});
