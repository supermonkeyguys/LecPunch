import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceController } from './attendance.controller';

describe('AttendanceController', () => {
  const attendanceService = {
    getCurrentSession: vi.fn(),
    checkIn: vi.fn(),
    checkOut: vi.fn()
  };
  const networkPolicyService = {
    getClientIp: vi.fn()
  };

  let controller: AttendanceController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AttendanceController(attendanceService as any, networkPolicyService as any);
  });

  it('returns current session shape for active attendance', async () => {
    attendanceService.getCurrentSession.mockResolvedValue({
      id: 'session-1',
      teamId: 'team-1',
      userId: 'user-1',
      checkInAt: '2026-04-03T00:00:00.000Z',
      elapsedSeconds: 30,
      status: 'active',
      weekKey: '2026-03-31'
    });

    const result = await controller.getCurrent({ userId: 'user-1' } as any);

    expect(result).toMatchObject({
      hasActiveSession: true,
      session: {
        id: 'session-1',
        elapsedSeconds: 30,
        status: 'active'
      }
    });
  });
});
