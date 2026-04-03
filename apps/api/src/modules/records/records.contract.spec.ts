import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordsController } from './records.controller';

describe('RecordsController contract', () => {
  const recordsService = {
    listMyRecords: vi.fn(),
    listMemberRecords: vi.fn()
  };

  let controller: RecordsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new RecordsController(recordsService as any);
  });

  it('returns paginated record response metadata instead of a bare array', async () => {
    recordsService.listMyRecords.mockResolvedValue([
      {
        id: 'session-1',
        userId: 'user-1',
        teamId: 'team-1',
        checkInAt: '2026-04-03T00:00:00.000Z',
        checkOutAt: '2026-04-03T02:00:00.000Z',
        durationSeconds: 7200,
        status: 'completed',
        weekKey: '2026-03-31'
      }
    ]);

    const result = await controller.myRecords({ userId: 'user-1' } as any, undefined, '1', '20');

    expect(result).toMatchObject({
      items: [
        expect.objectContaining({
          id: 'session-1',
          durationSeconds: 7200,
          status: 'completed'
        })
      ],
      page: 1,
      pageSize: 20
    });
  });
});
