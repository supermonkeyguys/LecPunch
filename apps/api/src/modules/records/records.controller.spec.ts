import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordsController } from './records.controller';

describe('RecordsController', () => {
  const recordsService = {
    listMyRecords: vi.fn(),
    listMemberRecords: vi.fn(),
    exportTeamRecords: vi.fn()
  };

  let controller: RecordsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new RecordsController(recordsService as any);
  });

  it('exports CSV with attachment headers for admins', async () => {
    recordsService.exportTeamRecords.mockResolvedValue([
      {
        sessionId: 'session-1',
        weekKey: '2026-04-06',
        userId: 'user-2',
        username: 'alice',
        displayName: 'Alice',
        realName: 'Alice Chen',
        studentId: '20240001',
        enrollYear: 2024,
        checkInAt: new Date('2026-04-09T01:00:00.000Z'),
        checkOutAt: new Date('2026-04-09T03:00:00.000Z'),
        durationSeconds: 7200,
        status: 'completed',
        invalidReason: undefined
      }
    ]);

    const response = {
      setHeader: vi.fn()
    } as any;

    const result = await controller.exportTeamRecords(
      { userId: 'admin-1', teamId: 'team-1', role: 'admin' } as any,
      response,
      '2026-04-06'
    );

    expect(recordsService.exportTeamRecords).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1', teamId: 'team-1' }),
      { weekKey: '2026-04-06', startDate: undefined, endDate: undefined }
    );
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="team-records-2026-04-06.csv"'
    );
    expect(result).toContain('记录ID');
    expect(result).toContain('Alice');
    expect(result.startsWith('\uFEFF')).toBe(true);
  });
});
