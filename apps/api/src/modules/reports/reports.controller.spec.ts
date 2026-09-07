import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  const reportsService = {
    createReport: vi.fn(),
    listTeamReports: vi.fn(),
    getImageForAdmin: vi.fn()
  };
  let controller: ReportsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ReportsController(reportsService as any);
  });

  it('lets an authenticated member submit a report', async () => {
    reportsService.createReport.mockResolvedValue({ id: 'report-1' });
    const user = { userId: 'member-1', teamId: 'team-1', role: 'member', username: 'member', displayName: '成员甲', enrollYear: 2024 } as any;

    await expect(controller.createReport(user, { description: '举报说明' }, [])).resolves.toEqual({ id: 'report-1' });
    expect(reportsService.createReport).toHaveBeenCalledWith(user, { description: '举报说明' }, []);
  });

  it('prevents a member from listing team reports', () => {
    const user = { userId: 'member-1', teamId: 'team-1', role: 'member' } as any;

    expect(() => controller.listReports(user, { page: 1, pageSize: 20 })).toThrow(ForbiddenException);
    expect(reportsService.listTeamReports).not.toHaveBeenCalled();
  });
});
