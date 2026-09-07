import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';

describe('AttendanceController', () => {
  const attendanceService = {
    getCurrentSession: vi.fn(),
    listTeamActiveSessions: vi.fn(),
    checkIn: vi.fn(),
    checkOut: vi.fn(),
    keepAlive: vi.fn(),
    getMyWeeklySummary: vi.fn(),
    adjustCurrentWeekDuration: vi.fn(),
    listTeamWeekDurationAdjustments: vi.fn()
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

  it('forwards the strict weekly summary query to the authenticated user service', async () => {
    attendanceService.getMyWeeklySummary.mockResolvedValue({
      week: '2026-W36',
      totalFocusedMinutes: 91,
      totalPoints: 91,
      checkedInDays: 2,
      days: [{ date: '2026-08-31', focusedMinutes: 61, sessions: 2, points: 61 }]
    });

    await expect(
      controller.getMyWeeklySummary({ userId: 'user-1', teamId: 'team-1' } as any, { week: '2026-W36' })
    ).resolves.toMatchObject({
      week: '2026-W36',
      totalFocusedMinutes: 91,
      totalPoints: 91,
      checkedInDays: 2,
      days: [expect.objectContaining({ date: '2026-08-31', focusedMinutes: 61, sessions: 2, points: 61 })]
    });

    expect(attendanceService.getMyWeeklySummary).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', teamId: 'team-1' }),
      '2026-W36'
    );
  });

  it('keeps the legacy keepalive endpoint read-only and free of IP resolution', async () => {
    attendanceService.keepAlive.mockResolvedValue({
      id: 'session-1',
      teamId: 'team-1',
      userId: 'user-1',
      checkInAt: '2026-04-11T00:00:00.000Z',
      lastKeepaliveAt: '2026-04-11T00:00:30.000Z',
      status: 'active',
      weekKey: '2026-04-07'
    });

    const result = await controller.keepAlive({ userId: 'user-1', teamId: 'team-1' } as any);

    expect(networkPolicyService.getClientIp).not.toHaveBeenCalled();
    expect(attendanceService.keepAlive).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    expect(result).toMatchObject({
      id: 'session-1',
      lastKeepaliveAt: '2026-04-11T00:00:30.000Z'
    });
  });

  it('allows only administrators to create current-week duration adjustments', async () => {
    attendanceService.adjustCurrentWeekDuration.mockResolvedValue({
      username: 'alice',
      resultingDurationSeconds: 4_500
    });

    await expect(
      controller.adjustCurrentWeekDuration(
        { userId: 'admin-1', teamId: 'team-1', role: 'admin' } as any,
        { username: 'alice', operation: 'add', durationSeconds: 300 }
      )
    ).resolves.toMatchObject({ resultingDurationSeconds: 4_500 });

    await expect(
      controller.adjustCurrentWeekDuration(
        { userId: 'member-1', teamId: 'team-1', role: 'member' } as any,
        { username: 'alice', operation: 'subtract', durationSeconds: 300 }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(attendanceService.adjustCurrentWeekDuration).toHaveBeenCalledTimes(1);
  });

  it('allows only administrators to read the team weekly adjustment audit', async () => {
    attendanceService.listTeamWeekDurationAdjustments.mockResolvedValue({ week: '2026-W36', items: [] });

    await expect(
      controller.getAdminWeeklyAdjustments(
        { userId: 'admin-1', teamId: 'team-1', role: 'admin' } as any,
        { week: '2026-W36' }
      )
    ).resolves.toEqual({ week: '2026-W36', items: [] });

    expect(attendanceService.listTeamWeekDurationAdjustments).toHaveBeenCalledWith('team-1', '2026-W36');
    expect(() =>
      controller.getAdminWeeklyAdjustments(
        { userId: 'member-1', teamId: 'team-1', role: 'member' } as any,
        { week: '2026-W36' }
      )
    ).toThrow(ForbiddenException);
  });
});
