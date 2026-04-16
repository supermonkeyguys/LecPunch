import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceController } from './attendance.controller';

describe('AttendanceController', () => {
  const attendanceService = {
    getCurrentSession: vi.fn(),
    listTeamActiveSessions: vi.fn(),
    checkIn: vi.fn(),
    checkOut: vi.fn(),
    keepAlive: vi.fn()
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

  it('resolves team-scoped client IPs before check-in', async () => {
    networkPolicyService.getClientIp.mockResolvedValue('203.0.113.10');
    attendanceService.checkIn.mockResolvedValue({
      id: 'session-1',
      teamId: 'team-1',
      userId: 'user-1',
      checkInAt: '2026-04-11T00:00:00.000Z',
      status: 'active',
      weekKey: '2026-04-07'
    });

    const result = await controller.checkIn(
      { userId: 'user-1', teamId: 'team-1' } as any,
      {
        headers: {},
        ip: '::ffff:127.0.0.1',
        socket: { remoteAddress: '::ffff:127.0.0.1' }
      } as any
    );

    expect(networkPolicyService.getClientIp).toHaveBeenCalledWith(
      'team-1',
      expect.objectContaining({
        ip: '::ffff:127.0.0.1'
      })
    );
    expect(attendanceService.checkIn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      '203.0.113.10'
    );
    expect(result).toMatchObject({
      id: 'session-1',
      teamId: 'team-1'
    });
  });

  it('returns team active attendance items inside an items wrapper', async () => {
    attendanceService.listTeamActiveSessions.mockResolvedValue([
      {
        memberKey: 'member-key-user-2',
        displayName: 'Bob',
        enrollYear: 2025,
        checkInAt: '2026-04-11T00:00:00.000Z',
        elapsedSeconds: 90,
        weekKey: '2026-04-07'
      }
    ]);

    const result = await controller.getTeamActive({ teamId: 'team-1' } as any);

    expect(attendanceService.listTeamActiveSessions).toHaveBeenCalledWith('team-1');
    expect(result).toMatchObject({
      items: [
        {
          memberKey: 'member-key-user-2',
          displayName: 'Bob',
          elapsedSeconds: 90
        }
      ]
    });
  });

  it('resolves team-scoped client IPs before keepalive', async () => {
    networkPolicyService.getClientIp.mockResolvedValue('203.0.113.10');
    attendanceService.keepAlive.mockResolvedValue({
      id: 'session-1',
      teamId: 'team-1',
      userId: 'user-1',
      checkInAt: '2026-04-11T00:00:00.000Z',
      lastKeepaliveAt: '2026-04-11T00:00:30.000Z',
      status: 'active',
      weekKey: '2026-04-07'
    });

    const result = await controller.keepAlive(
      { userId: 'user-1', teamId: 'team-1' } as any,
      {
        headers: {},
        ip: '::ffff:127.0.0.1',
        socket: { remoteAddress: '::ffff:127.0.0.1' }
      } as any
    );

    expect(networkPolicyService.getClientIp).toHaveBeenCalledWith(
      'team-1',
      expect.objectContaining({
        ip: '::ffff:127.0.0.1'
      })
    );
    expect(attendanceService.keepAlive).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      '203.0.113.10'
    );
    expect(result).toMatchObject({
      id: 'session-1',
      lastKeepaliveAt: '2026-04-11T00:00:30.000Z'
    });
  });
});
