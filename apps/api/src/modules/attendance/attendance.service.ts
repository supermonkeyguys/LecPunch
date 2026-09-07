import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AttendanceSession, AttendanceSessionDocument } from './schemas/attendance-session.schema';
import {
  AttendanceDurationAdjustment,
  AttendanceDurationAdjustmentDocument,
  type AttendanceDurationAdjustmentOperation
} from './schemas/attendance-duration-adjustment.schema';
import { NetworkPolicyService } from '../network-policy/network-policy.service';
import { UsersService } from '../users/users.service';
import {
  ERROR_CODES,
  ATTENDANCE_MAX_SECONDS,
  weeklyGoalSeconds
} from '@lecpunch/shared';
import { getShanghaiDateRange, getWeekKey, parseIsoWeekKey } from '../../common/utils/time.util';
import type { AuthUser } from '../auth/types/auth-user.type';
import { PointsService } from '../points/points.service';
import type { AdjustCurrentWeekDurationDto } from './dto/adjust-current-week-duration.dto';

type DurationAdjustmentSummaryItem = {
  adjustmentId: string;
  operation: AttendanceDurationAdjustmentOperation;
  durationSeconds: number;
  signedDurationSeconds: number;
  reason: string | null;
  createdAt: string;
};

type DurationAdjustmentAggregate = {
  manualAdjustmentSeconds: number;
  adjustmentsCount: number;
};

@Injectable()
export class AttendanceService {
  private readonly durationAdjustmentLocks = new Map<string, Promise<void>>();

  constructor(
    @InjectModel(AttendanceSession.name)
    private readonly attendanceModel: Model<AttendanceSessionDocument>,
    @InjectModel(AttendanceDurationAdjustment.name)
    private readonly attendanceDurationAdjustmentModel: Model<AttendanceDurationAdjustmentDocument>,
    private readonly networkPolicyService: NetworkPolicyService,
    private readonly usersService: UsersService,
    @Optional() private readonly pointsService?: PointsService
  ) {}

  async getCurrentSession(userId: string) {
    const session = await this.findActiveSession(userId);
    if (!session) {
      return null;
    }

    const now = new Date();
    const isOvertime = await this.invalidateSessionIfOvertime(session, now);
    if (isOvertime) {
      return null;
    }

    const baseSession = typeof session.toObject === 'function' ? session.toObject() : session;

    return {
      ...baseSession,
      id: session.id,
      isPaused: false,
      elapsedSeconds: this.getElapsedSeconds(session, now)
    };
  }

  async checkIn(user: AuthUser, clientIp: string) {
    await this.networkPolicyService.assertIpAllowed(user.teamId, clientIp);
    const existing = await this.findActiveSession(user.userId);
    if (existing) {
      throw new BadRequestException({
        code: ERROR_CODES.ATTENDANCE_ALREADY_CHECKED_IN,
        message: '当前已有进行中的打卡'
      });
    }

    const now = new Date();
    let session: AttendanceSessionDocument;
    try {
      session = await this.attendanceModel.create({
        teamId: user.teamId,
        userId: user.userId,
        checkInAt: now,
        status: 'active',
        sourceIpAtCheckIn: clientIp,
        weekKey: getWeekKey(now),
        weeklyGoalSecondsSnapshot: weeklyGoalSeconds(user.enrollYear)
      });
    } catch (error) {
      // A second request may pass findActiveSession before the first insert is
      // visible. MongoDB's partial unique index is the source of truth here.
      if (this.isDuplicateActiveSessionError(error)) {
        throw new BadRequestException({
          code: ERROR_CODES.ATTENDANCE_ALREADY_CHECKED_IN,
          message: '当前已有进行中的打卡'
        });
      }
      throw error;
    }

    return session;
  }

  async checkOut(user: AuthUser, clientIp: string) {
    const session = await this.findActiveSession(user.userId);
    if (!session) {
      throw new BadRequestException({
        code: ERROR_CODES.ATTENDANCE_NO_ACTIVE_SESSION,
        message: '当前没有进行中的打卡'
      });
    }

    const checkOutAt = new Date();

    await this.networkPolicyService.assertIpAllowed(user.teamId, clientIp);

    const isOvertime = await this.invalidateSessionIfOvertime(session, checkOutAt, clientIp);
    if (isOvertime) {
      return session;
    }

    const durationSeconds = this.getElapsedSeconds(session, checkOutAt);
    session.status = 'completed';
    session.durationSeconds = durationSeconds;
    session.checkOutAt = checkOutAt;
    session.sourceIpAtCheckOut = clientIp;
    await session.save();
    await this.syncSessionPoints(session, durationSeconds);
    return session;
  }

  /**
   * Kept temporarily for older clients. It is deliberately a read-only
   * compatibility endpoint: attendance duration and active status no longer
   * depend on browser or desktop heartbeats.
   */
  async keepAlive(user: AuthUser) {
    const session = await this.findActiveSession(user.userId);
    if (!session) {
      throw new BadRequestException({
        code: ERROR_CODES.ATTENDANCE_NO_ACTIVE_SESSION,
        message: '当前没有进行中的打卡'
      });
    }

    const now = new Date();
    const isOvertime = await this.invalidateSessionIfOvertime(session, now);
    if (isOvertime) {
      throw this.createSessionInvalidatedException();
    }
    return session;
  }

  async getMyWeeklySummary(user: AuthUser, isoWeekKey: string) {
    const monday = parseIsoWeekKey(isoWeekKey);
    if (!monday) {
      throw new BadRequestException({
        code: 'ATTENDANCE_WEEK_INVALID',
        message: 'week must be a valid ISO week in YYYY-Www format'
      });
    }

    const attendanceWeekKey = monday.toFormat('yyyy-LL-dd');
    const [rows, adjustments] = await Promise.all([
      this.attendanceModel
      .aggregate<{ _id: string; focusedSeconds: number; sessions: number }>([
        {
          $match: {
            teamId: user.teamId,
            userId: user.userId,
            weekKey: attendanceWeekKey,
            status: { $ne: 'active' }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$checkInAt',
                timezone: 'Asia/Shanghai'
              }
            },
            focusedSeconds: { $sum: { $ifNull: ['$durationSeconds', 0] } },
            sessions: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .exec(),
      this.listWeekDurationAdjustments(user.teamId, user.userId, attendanceWeekKey)
    ]);

    const days = rows.map((row) => ({
      date: row._id,
      focusedMinutes: Math.floor((row.focusedSeconds ?? 0) / 60),
      sessions: row.sessions ?? 0,
      points: Math.floor((row.focusedSeconds ?? 0) / 60)
    }));

    const recordedFocusedSeconds = rows.reduce((total, row) => total + (row.focusedSeconds ?? 0), 0);
    const manualAdjustmentSeconds = adjustments.reduce(
      (total, adjustment) => total + adjustment.signedDurationSeconds,
      0
    );
    const effectiveFocusedSeconds = Math.max(0, recordedFocusedSeconds + manualAdjustmentSeconds);
    const totalFocusedMinutes = Math.floor(effectiveFocusedSeconds / 60);

    return {
      week: isoWeekKey,
      totalFocusedMinutes,
      totalPoints: Math.floor(recordedFocusedSeconds / 60),
      rawFocusedMinutes: Math.floor(recordedFocusedSeconds / 60),
      adjustedMinutes: Math.trunc(manualAdjustmentSeconds / 60),
      adjustmentsCount: adjustments.length,
      checkedInDays: days.length,
      days,
      adjustments: adjustments.map(({ adjustmentId: _adjustmentId, signedDurationSeconds: _signed, ...item }) => item)
    };
  }

  async adjustCurrentWeekDuration(currentUser: AuthUser, input: AdjustCurrentWeekDurationDto) {
    const username = input.username.trim().toLowerCase();
    const targetUser = await this.usersService.findByUsername(username);
    if (!targetUser) {
      throw new NotFoundException({ code: 'ATTENDANCE_ADJUSTMENT_USER_NOT_FOUND', message: '用户不存在' });
    }

    if (targetUser.teamId !== currentUser.teamId) {
      throw new ForbiddenException({
        code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN,
        message: '不可调整其他团队成员的打卡时长'
      });
    }

    const weekKey = getWeekKey(new Date());
    const lockKey = `${currentUser.teamId}:${targetUser.id}:${weekKey}`;
    return this.withDurationAdjustmentLock(lockKey, () =>
      this.applyCurrentWeekDurationAdjustment(currentUser, targetUser, weekKey, input)
    );
  }

  private async applyCurrentWeekDurationAdjustment(
    currentUser: AuthUser,
    targetUser: { id: string; username: string; displayName: string },
    weekKey: string,
    input: AdjustCurrentWeekDurationDto
  ) {
    const [recordedDurationSeconds, manualAdjustmentSeconds] = await Promise.all([
      this.getRecordedWeekDurationSeconds(currentUser.teamId, targetUser.id, weekKey),
      this.getManualAdjustmentSeconds(currentUser.teamId, targetUser.id, weekKey)
    ]);

    const previousDurationSeconds = recordedDurationSeconds + manualAdjustmentSeconds;
    const deltaSeconds = input.operation === 'add' ? input.durationSeconds : -input.durationSeconds;
    const resultingDurationSeconds = previousDurationSeconds + deltaSeconds;

    if (resultingDurationSeconds < 0) {
      throw new BadRequestException({
        code: 'ATTENDANCE_DURATION_CANNOT_BE_NEGATIVE',
        message: '扣减后的当前周打卡时长不能低于 0'
      });
    }

    const adjustment = await this.attendanceDurationAdjustmentModel.create({
      teamId: currentUser.teamId,
      userId: targetUser.id,
      username: targetUser.username,
      weekKey,
      operation: input.operation,
      durationSeconds: input.durationSeconds,
      signedDurationSeconds: deltaSeconds,
      previousDurationSeconds,
      resultingDurationSeconds,
      createdBy: currentUser.userId,
      reason: input.reason?.trim() || undefined
    });

    return this.mapDurationAdjustment(adjustment, targetUser.displayName);
  }

  async setTeamRecordMarked(
    teamId: string,
    recordId: string,
    isMarked: boolean
  ): Promise<{ record: AttendanceSessionDocument; changed: boolean }> {
    const updated = await this.attendanceModel.findOneAndUpdate(
      { _id: recordId, teamId, isMarked: { $ne: isMarked } },
      { $set: { isMarked } },
      { new: true }
    );

    if (updated) {
      return { record: updated, changed: true };
    }

    const record = await this.attendanceModel.findOne({ _id: recordId, teamId }).exec();
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    return { record, changed: false };
  }

  async deleteCompletedTeamRecord(teamId: string, recordId: string) {
    const record = await this.attendanceModel.findOne({ _id: recordId, teamId }).exec();

    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    if (record.status === 'active') {
      throw new BadRequestException({
        code: 'ADMIN_ACTIVE_RECORD_DELETE_FORBIDDEN',
        message: 'Active attendance records cannot be deleted'
      });
    }

    await record.deleteOne();
  }

  listUserRecords(
    userId: string,
    filters: { weekKey?: string; startDate?: string; endDate?: string },
    options: { page: number; pageSize: number }
  ) {
    const query: Record<string, unknown> = { userId };
    if (filters.weekKey) {
      query.weekKey = filters.weekKey;
    } else if (filters.startDate || filters.endDate) {
      query.checkInAt = getShanghaiDateRange(filters.startDate, filters.endDate);
    }

    const { page, pageSize } = options;
    return this.attendanceModel
      .find(query)
      .sort({ checkInAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .exec();
  }

  listTeamRecords(teamId: string, filters: { weekKey?: string; startDate?: string; endDate?: string }) {
    const query: Record<string, unknown> = { teamId };
    if (filters.weekKey) {
      query.weekKey = filters.weekKey;
    } else if (filters.startDate || filters.endDate) {
      query.checkInAt = getShanghaiDateRange(filters.startDate, filters.endDate);
    }
    return this.attendanceModel.find(query).sort({ checkInAt: -1 }).exec();
  }

  async listTeamActiveSessions(teamId: string) {
    const sessions = await this.attendanceModel.find({ teamId, status: 'active' }).sort({ checkInAt: 1 }).exec();
    const now = new Date();
    const checkedSessions = await Promise.all(
      sessions.map(async (session) => ((await this.invalidateSessionIfOvertime(session, now)) ? null : session))
    );
    const activeSessions = checkedSessions.filter(Boolean) as AttendanceSessionDocument[];

    const users = await this.usersService.findByIds(activeSessions.map((session) => session.userId));
    const userMap = new Map(users.map((user) => [user.id, user]));

    return activeSessions.map((session) => {
      const user = userMap.get(session.userId);

      return {
        memberKey: this.usersService.getMemberKey(session.userId),
        displayName: user?.displayName ?? '未知成员',
        enrollYear: user?.enrollYear ?? 0,
        avatarColor: user?.avatarColor,
        avatarEmoji: user?.avatarEmoji,
        avatarBase64: user?.avatarBase64,
        checkInAt: session.checkInAt,
        elapsedSeconds: this.getElapsedSeconds(session, now),
        weekKey: session.weekKey
      };
    });
  }

  getModel() {
    return this.attendanceModel;
  }

  private async getRecordedWeekDurationSeconds(teamId: string, userId: string, weekKey: string) {
    const rows = await this.attendanceModel
      .aggregate<{ totalSeconds: number }>([
        { $match: { teamId, userId, weekKey, status: { $ne: 'active' } } },
        {
          $group: {
            _id: null,
            totalSeconds: { $sum: { $ifNull: ['$durationSeconds', 0] } }
          }
        }
      ])
      .exec();

    return rows[0]?.totalSeconds ?? 0;
  }

  private async getManualAdjustmentSeconds(teamId: string, userId: string, weekKey: string) {
    const rows = await this.attendanceDurationAdjustmentModel
      .aggregate<{ totalSeconds: number }>([
        { $match: { teamId, userId, weekKey } },
        {
          $group: {
            _id: null,
            totalSeconds: {
              $sum: {
                $cond: [
                  { $eq: ['$operation', 'add'] },
                  '$durationSeconds',
                  { $multiply: ['$durationSeconds', -1] }
                ]
              }
            }
          }
        }
      ])
      .exec();

    return rows[0]?.totalSeconds ?? 0;
  }

  /**
   * Returns signed adjustment totals without changing the immutable attendance
   * sessions. Every display/report aggregate must add this value to the raw
   * attendance duration; points deliberately continue to use raw duration.
   */
  async getManualAdjustmentSummaries(teamId: string, userIds?: string[]) {
    const match: Record<string, unknown> = { teamId };
    if (userIds?.length) {
      match.userId = { $in: userIds };
    }

    const rows = await this.attendanceDurationAdjustmentModel
      .aggregate<{ _id: { userId: string; weekKey: string }; totalSeconds: number; adjustmentsCount: number }>([
        { $match: match },
        {
          $group: {
            _id: { userId: '$userId', weekKey: '$weekKey' },
            totalSeconds: { $sum: '$signedDurationSeconds' },
            adjustmentsCount: { $sum: 1 }
          }
        }
      ])
      .exec();

    return new Map<string, DurationAdjustmentAggregate>(
      rows.map((row) => [
        `${row._id.userId}:${row._id.weekKey}`,
        { manualAdjustmentSeconds: row.totalSeconds, adjustmentsCount: row.adjustmentsCount }
      ])
    );
  }

  private async listWeekDurationAdjustments(
    teamId: string,
    userId: string,
    weekKey: string
  ): Promise<DurationAdjustmentSummaryItem[]> {
    const adjustments = await this.attendanceDurationAdjustmentModel
      .find({ teamId, userId, weekKey })
      .sort({ createdAt: 1 })
      .exec();

    return adjustments.map((adjustment) => ({
      adjustmentId: adjustment.id,
      operation: adjustment.operation as AttendanceDurationAdjustmentOperation,
      durationSeconds: adjustment.durationSeconds,
      signedDurationSeconds: adjustment.signedDurationSeconds,
      reason: adjustment.reason ?? null,
      createdAt: adjustment.createdAt?.toISOString() ?? ''
    }));
  }

  async getWeekDurationAdjustmentsForUsers(teamId: string, userIds: string[], weekKey: string) {
    if (userIds.length === 0) {
      return new Map<string, DurationAdjustmentSummaryItem[]>();
    }

    const adjustments = await this.attendanceDurationAdjustmentModel
      .find({ teamId, userId: { $in: userIds }, weekKey })
      .sort({ createdAt: 1 })
      .exec();
    const itemsByUserId = new Map<string, DurationAdjustmentSummaryItem[]>();

    for (const adjustment of adjustments) {
      const items = itemsByUserId.get(adjustment.userId) ?? [];
      items.push({
        adjustmentId: adjustment.id,
        operation: adjustment.operation as AttendanceDurationAdjustmentOperation,
        durationSeconds: adjustment.durationSeconds,
        signedDurationSeconds: adjustment.signedDurationSeconds,
        reason: adjustment.reason ?? null,
        createdAt: adjustment.createdAt?.toISOString() ?? ''
      });
      itemsByUserId.set(adjustment.userId, items);
    }

    return itemsByUserId;
  }

  async listTeamWeekDurationAdjustments(teamId: string, isoWeekKey: string) {
    const monday = parseIsoWeekKey(isoWeekKey);
    if (!monday) {
      throw new BadRequestException({
        code: 'ATTENDANCE_WEEK_INVALID',
        message: 'week must be a valid ISO week in YYYY-Www format'
      });
    }
    const weekKey = monday.toFormat('yyyy-LL-dd');
    const adjustments = await this.attendanceDurationAdjustmentModel
      .find({ teamId, weekKey })
      .sort({ createdAt: -1 })
      .exec();
    const users = await this.usersService.findByIds([...new Set(adjustments.map((item) => item.userId))]);
    const userById = new Map(users.map((item) => [item.id, item]));

    return {
      week: isoWeekKey,
      items: adjustments.map((adjustment) => {
        const member = userById.get(adjustment.userId);
        return {
          adjustmentId: adjustment.id,
          userId: adjustment.userId,
          username: adjustment.username,
          displayName: member?.displayName ?? adjustment.username,
          operation: adjustment.operation as AttendanceDurationAdjustmentOperation,
          durationSeconds: adjustment.durationSeconds,
          signedDurationSeconds: adjustment.signedDurationSeconds,
          reason: adjustment.reason ?? null,
          createdAt: adjustment.createdAt?.toISOString() ?? ''
        };
      })
    };
  }

  private mapDurationAdjustment(adjustment: AttendanceDurationAdjustmentDocument, displayName: string) {
    return {
      adjustmentId: adjustment.id,
      username: adjustment.username,
      displayName,
      weekKey: adjustment.weekKey,
      operation: adjustment.operation as AttendanceDurationAdjustmentOperation,
      durationSeconds: adjustment.durationSeconds,
      previousDurationSeconds: adjustment.previousDurationSeconds,
      resultingDurationSeconds: adjustment.resultingDurationSeconds,
      reason: adjustment.reason,
      createdAt: adjustment.createdAt
    };
  }

  private async withDurationAdjustmentLock<T>(key: string, operation: () => Promise<T>) {
    const previousLock = this.durationAdjustmentLocks.get(key) ?? Promise.resolve();
    let releaseCurrentLock!: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseCurrentLock = resolve;
    });
    this.durationAdjustmentLocks.set(key, currentLock);

    await previousLock;
    try {
      return await operation();
    } finally {
      releaseCurrentLock();
      if (this.durationAdjustmentLocks.get(key) === currentLock) {
        this.durationAdjustmentLocks.delete(key);
      }
    }
  }

  private findActiveSession(userId: string) {
    return this.attendanceModel.findOne({ userId, status: 'active' }).exec();
  }

  private getElapsedSeconds(session: AttendanceSessionDocument, at = new Date()) {
    return Math.max(0, Math.floor((at.getTime() - session.checkInAt.getTime()) / 1000));
  }

  private hasExceededMaxNaturalDuration(session: AttendanceSessionDocument, now: Date) {
    const naturalDurationSeconds = Math.max(0, Math.floor((now.getTime() - session.checkInAt.getTime()) / 1000));
    return naturalDurationSeconds >= ATTENDANCE_MAX_SECONDS;
  }

  private async invalidateSessionIfOvertime(
    session: AttendanceSessionDocument,
    now: Date,
    sourceIpAtCheckOut?: string
  ) {
    if (!this.hasExceededMaxNaturalDuration(session, now)) {
      return false;
    }

    session.status = 'invalidated';
    session.durationSeconds = 0;
    session.invalidReason = 'overtime_5h';
    session.checkOutAt ??= now;
    if (sourceIpAtCheckOut) {
      session.sourceIpAtCheckOut = sourceIpAtCheckOut;
    }
    await session.save();
    await this.syncSessionPoints(session, 0);
    return true;
  }

  private createSessionInvalidatedException() {
    return new BadRequestException({
      code: ERROR_CODES.ATTENDANCE_SESSION_INVALIDATED,
      message: '当前打卡已失效，请重新上卡'
    });
  }

  private isDuplicateActiveSessionError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      Number((error as { code?: unknown }).code) === 11000
    );
  }

  private async syncSessionPoints(session: AttendanceSessionDocument, durationSeconds: number) {
    await this.pointsService?.syncAttendancePoints({
      teamId: session.teamId,
      userId: session.userId,
      attendanceSessionId: session.id,
      weekKey: session.weekKey,
      durationSeconds,
      isValid: session.status === 'completed'
    });
  }
}
