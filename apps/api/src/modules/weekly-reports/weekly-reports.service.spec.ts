import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { WeeklyReportsService } from './weekly-reports.service';

const user = {
  userId: 'user-1',
  teamId: 'team-1',
  username: 'alice',
  displayName: 'Alice',
  role: 'member' as const,
  enrollYear: 2024
};

describe('WeeklyReportsService', () => {
  const findOne = vi.fn();
  const findOneAndUpdate = vi.fn();
  const find = vi.fn();
  const model = { findOne, findOneAndUpdate, find } as any;
  const githubSourcesService = { findForUser: vi.fn() };
  const usersService = { listTeamMembers: vi.fn() };
  const attendanceService = {
    getMyWeeklySummary: vi.fn(),
    getManualAdjustmentSummaries: vi.fn(),
    getWeekDurationAdjustmentsForUsers: vi.fn()
  };
  let service: WeeklyReportsService;

  beforeEach(() => {
    vi.clearAllMocks();
    attendanceService.getMyWeeklySummary.mockResolvedValue({ week: '2026-W36', adjustments: [] });
    attendanceService.getManualAdjustmentSummaries.mockResolvedValue(new Map());
    attendanceService.getWeekDurationAdjustmentsForUsers.mockResolvedValue(new Map());
    service = new WeeklyReportsService(model, githubSourcesService as any, usersService as any, attendanceService as any);
  });

  it('saves a generated report only when its raw URL exactly matches the configured source', async () => {
    githubSourcesService.findForUser.mockResolvedValue({
      enabled: true,
      repoUrl: 'https://github.com/example/daily-log',
      branch: 'main'
    });
    findOneAndUpdate.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        githubPath: 'lecpunch/reports/2026-W36.md',
        rawUrl: 'https://raw.githubusercontent.com/example/daily-log/main/lecpunch/reports/2026-W36.md',
        commitSha: 'abcdef1234567',
        dailyLogCount: 5,
        status: 'generated',
        generatedAt: new Date('2026-09-01T00:00:00.000Z'),
        updatedAt: new Date('2026-09-01T00:00:00.000Z')
      })
    });

    await expect(
      service.upsertMine(user, '2026-W36', {
        status: 'generated',
        githubPath: 'lecpunch/reports/2026-W36.md',
        rawUrl: 'https://raw.githubusercontent.com/example/daily-log/main/lecpunch/reports/2026-W36.md',
        commitSha: 'abcdef1234567',
        dailyLogCount: 5
      })
    ).resolves.toMatchObject({ week: '2026-W36', item: { status: 'generated', dailyLogCount: 5 } });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1', weekKey: '2026-W36' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'generated', githubPath: 'lecpunch/reports/2026-W36.md' }),
        $setOnInsert: { userId: 'user-1', weekKey: '2026-W36' }
      }),
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  });

  it('rejects a raw URL that does not belong to the current user configured repository', async () => {
    githubSourcesService.findForUser.mockResolvedValue({
      enabled: true,
      repoUrl: 'https://github.com/example/daily-log',
      branch: 'main'
    });

    await expect(
      service.upsertMine(user, '2026-W36', {
        status: 'generated',
        githubPath: 'lecpunch/reports/2026-W36.md',
        rawUrl: 'https://raw.githubusercontent.com/attacker/other/main/lecpunch/reports/2026-W36.md'
      })
    ).rejects.toMatchObject({ response: { code: 'WEEKLY_REPORT_RAW_URL_MISMATCH' } });
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a raw GitHub URL containing a repository traversal segment', async () => {
    githubSourcesService.findForUser.mockResolvedValue({
      enabled: true,
      repoUrl: 'https://github.com/me/victim',
      branch: 'main'
    });

    await expect(
      service.upsertMine(user, '2026-W36', {
        status: 'generated',
        githubPath: 'x.md',
        rawUrl: 'https://raw.githubusercontent.com/me/../victim/main/x.md'
      })
    ).rejects.toMatchObject({ response: { code: 'WEEKLY_REPORT_RAW_URL_MISMATCH' } });
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('allows pending or missing state without requesting GitHub or storing a URL', async () => {
    findOneAndUpdate.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        githubPath: null,
        rawUrl: null,
        commitSha: null,
        dailyLogCount: 0,
        status: 'pending',
        generatedAt: null,
        updatedAt: new Date('2026-09-01T00:00:00.000Z')
      })
    });

    await expect(service.upsertMine(user, '2026-W36', { status: 'pending' })).resolves.toMatchObject({
      item: { status: 'pending', rawUrl: null }
    });
    expect(githubSourcesService.findForUser).not.toHaveBeenCalled();
  });

  it('returns every member in the team and marks missing references without exposing other teams', async () => {
    usersService.listTeamMembers.mockResolvedValue([
      { id: 'user-1', username: 'alice', displayName: 'Alice', role: 'member', status: 'active' },
      { id: 'user-2', username: 'bob', displayName: 'Bob', role: 'admin', status: 'active' }
    ]);
    find.mockReturnValue({
      exec: vi.fn().mockResolvedValue([
        {
          userId: 'user-1',
          githubPath: 'lecpunch/reports/2026-W36.md',
          rawUrl: 'https://raw.githubusercontent.com/example/daily-log/main/lecpunch/reports/2026-W36.md',
          commitSha: null,
          dailyLogCount: 2,
          status: 'generated',
          generatedAt: new Date('2026-09-01T00:00:00.000Z'),
          updatedAt: new Date('2026-09-01T00:00:00.000Z')
        }
      ])
    });

    await expect(service.listForAdmin('team-1', '2026-W36')).resolves.toMatchObject({
      week: '2026-W36',
      items: [
        { member: { userId: 'user-1' }, status: 'generated' },
        { member: { userId: 'user-2' }, status: 'missing', rawUrl: null }
      ]
    });
    expect(usersService.listTeamMembers).toHaveBeenCalledWith('team-1');
    expect(find).toHaveBeenCalledWith({ userId: { $in: ['user-1', 'user-2'] }, weekKey: '2026-W36' });
  });

  it('rejects invalid ISO week keys before accessing data', async () => {
    await expect(service.getMine(user, '2026-W54')).rejects.toBeInstanceOf(BadRequestException);
    expect(findOne).not.toHaveBeenCalled();
  });
});
