import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AttendanceSession, AttendanceSessionDocument } from './schemas/attendance-session.schema';
import { NetworkPolicyService } from '../network-policy/network-policy.service';
import { UsersService } from '../users/users.service';
import {
  ERROR_CODES,
  ATTENDANCE_KEEPALIVE_TIMEOUT_SECONDS,
  ATTENDANCE_MAX_SECONDS,
  weeklyGoalSeconds
} from '@lecpunch/shared';
import { getShanghaiDateRange, getWeekKey } from '../../common/utils/time.util';
import type { AuthUser } from '../auth/types/auth-user.type';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(AttendanceSession.name)
    private readonly attendanceModel: Model<AttendanceSessionDocument>,
    private readonly networkPolicyService: NetworkPolicyService,
    private readonly usersService: UsersService
  ) {}

  async getCurrentSession(userId: string) {
    const session = await this.findActiveSession(userId);
    if (!session) {
      return null;
    }

    const activeSession = await this.invalidateStaleSessionIfNeeded(session);
    if (!activeSession) {
      return null;
    }

    const baseSession = typeof activeSession.toObject === 'function' ? activeSession.toObject() : activeSession;

    return {
      ...baseSession,
      id: activeSession.id,
      elapsedSeconds: this.getElapsedSeconds(activeSession)
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
    const session = await this.attendanceModel.create({
      teamId: user.teamId,
      userId: user.userId,
      checkInAt: now,
      lastKeepaliveAt: now,
      status: 'active',
      sourceIpAtCheckIn: clientIp,
      weekKey: getWeekKey(now),
      weeklyGoalSecondsSnapshot: weeklyGoalSeconds(user.enrollYear)
    });

    return session;
  }

  async checkOut(user: AuthUser, clientIp: string) {
    await this.networkPolicyService.assertIpAllowed(user.teamId, clientIp);
    const session = await this.findActiveSession(user.userId);
    if (!session) {
      throw new BadRequestException({
        code: ERROR_CODES.ATTENDANCE_NO_ACTIVE_SESSION,
        message: '当前没有进行中的打卡'
      });
    }

    const activeSession = await this.invalidateStaleSessionIfNeeded(session);
    if (!activeSession) {
      throw this.createSessionInvalidatedException();
    }

    const checkOutAt = new Date();
    const durationSeconds = Math.floor((checkOutAt.getTime() - activeSession.checkInAt.getTime()) / 1000);

    if (durationSeconds >= ATTENDANCE_MAX_SECONDS) {
      activeSession.status = 'invalidated';
      activeSession.durationSeconds = 0;
      activeSession.invalidReason = 'overtime_5h';
    } else {
      activeSession.status = 'completed';
      activeSession.durationSeconds = durationSeconds;
    }

    activeSession.checkOutAt = checkOutAt;
    activeSession.sourceIpAtCheckOut = clientIp;
    await activeSession.save();
    return activeSession;
  }

  async keepAlive(user: AuthUser, clientIp: string) {
    await this.networkPolicyService.assertIpAllowed(user.teamId, clientIp);
    const session = await this.findActiveSession(user.userId);
    if (!session) {
      throw new BadRequestException({
        code: ERROR_CODES.ATTENDANCE_NO_ACTIVE_SESSION,
        message: '当前没有进行中的打卡'
      });
    }

    const activeSession = await this.invalidateStaleSessionIfNeeded(session);
    if (!activeSession) {
      throw this.createSessionInvalidatedException();
    }

    activeSession.lastKeepaliveAt = new Date();
    await activeSession.save();
    return activeSession;
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
    const activeSessions = (
      await Promise.all(sessions.map((session) => this.invalidateStaleSessionIfNeeded(session)))
    ).filter((session): session is AttendanceSessionDocument => Boolean(session));
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
        elapsedSeconds: this.getElapsedSeconds(session),
        weekKey: session.weekKey
      };
    });
  }

  getModel() {
    return this.attendanceModel;
  }

  private findActiveSession(userId: string) {
    return this.attendanceModel.findOne({ userId, status: 'active' }).exec();
  }

  private getElapsedSeconds(session: AttendanceSessionDocument) {
    return Math.max(0, Math.floor((Date.now() - session.checkInAt.getTime()) / 1000));
  }

  private async invalidateStaleSessionIfNeeded(session: AttendanceSessionDocument) {
    const lastKeepaliveAt = session.lastKeepaliveAt ?? session.checkInAt;
    const timeoutMs = ATTENDANCE_KEEPALIVE_TIMEOUT_SECONDS * 1000;

    if (Date.now() - lastKeepaliveAt.getTime() < timeoutMs) {
      return session;
    }

    session.status = 'invalidated';
    session.durationSeconds = 0;
    session.invalidReason = 'heartbeat_timeout';
    session.checkOutAt ??= new Date();
    await session.save();
    return null;
  }

  private createSessionInvalidatedException() {
    return new BadRequestException({
      code: ERROR_CODES.ATTENDANCE_SESSION_INVALIDATED,
      message: '当前打卡已失效，请重新上卡'
    });
  }
}
