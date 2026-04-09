import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AttendanceService } from './attendance.service';
import { ERROR_CODES, ATTENDANCE_MAX_SECONDS } from '@lecpunch/shared';
import type { AuthUser } from '../auth/types/auth-user.type';

const user: AuthUser = {
  userId: 'user-1',
  teamId: 'team-1',
  role: 'member',
  username: 'alice',
  displayName: 'Alice',
  enrollYear: 2024
};

describe('AttendanceService', () => {
  const create = vi.fn();
  const findOne = vi.fn();
  const find = vi.fn();
  const networkPolicyService = {
    assertIpAllowed: vi.fn()
  };

  const attendanceModel = {
    create,
    findOne,
    find
  } as any;

  let service: AttendanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    service = new AttendanceService(attendanceModel, networkPolicyService as any);
  });

  it('rejects duplicate check-in when an active session already exists', async () => {
    findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ id: 'existing-session' })
    });

    await expect(service.checkIn(user, '127.0.0.1')).rejects.toMatchObject({
      response: {
        code: ERROR_CODES.ATTENDANCE_ALREADY_CHECKED_IN
      }
    });
  });

  it('invalidates a check-out when session duration reaches five hours', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const activeSession = {
      id: 'session-1',
      checkInAt: new Date(Date.now() - ATTENDANCE_MAX_SECONDS * 1000),
      status: 'active',
      save
    } as any;

    findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(activeSession)
    });

    const result = await service.checkOut(user, '127.0.0.1');

    expect(result.status).toBe('invalidated');
    expect(result.durationSeconds).toBe(0);
    expect(result.invalidReason).toBe('overtime_5h');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('returns current session payload with elapsed seconds for active attendance', async () => {
    const activeSession = {
      id: 'session-1',
      teamId: 'team-1',
      userId: 'user-1',
      checkInAt: new Date(Date.now() - 90_000),
      status: 'active',
      weekKey: '2026-03-30'
    } as any;

    findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(activeSession)
    });

    const result = await service.getCurrentSession(user.userId);

    expect(result).toBeTruthy();
    expect(typeof result?.elapsedSeconds).toBe('number');
    expect(result?.elapsedSeconds).toBeGreaterThanOrEqual(90);
  });

  it('stores week keys using Asia/Shanghai boundaries on check-in', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-05T16:30:00.000Z'));
    findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null)
    });
    create.mockImplementation(async (payload) => payload);

    const result = await service.checkIn(user, '127.0.0.1');

    expect(result.weekKey).toBe('2026-04-06');
  });

  it('builds record date filters using Asia/Shanghai day boundaries', async () => {
    const exec = vi.fn().mockResolvedValue([]);
    const limit = vi.fn().mockReturnValue({ exec });
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });
    find.mockReturnValue({ sort });

    await service.listUserRecords(
      user.userId,
      { startDate: '2026-04-09', endDate: '2026-04-10' },
      { page: 1, pageSize: 20 }
    );

    expect(find).toHaveBeenCalledWith({
      userId: 'user-1',
      checkInAt: {
        $gte: new Date('2026-04-08T16:00:00.000Z'),
        $lte: new Date('2026-04-10T15:59:59.999Z')
      }
    });
    expect(sort).toHaveBeenCalledWith({ checkInAt: -1 });
  });
});
