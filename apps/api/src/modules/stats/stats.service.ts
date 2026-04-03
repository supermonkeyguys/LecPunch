import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from '../attendance/attendance.service';
import { UsersService } from '../users/users.service';
import { DateTime } from 'luxon';
import { TIMEZONE, ERROR_CODES } from '@lecpunch/shared';

@Injectable()
export class StatsService {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly usersService: UsersService
  ) {}

  getMyWeeklyStats(userId: string, limit = 6) {
    const model = this.attendanceService.getModel();
    return model
      .aggregate([
        { $match: { userId, status: { $ne: 'active' } } },
        {
          $group: {
            _id: '$weekKey',
            totalDurationSeconds: { $sum: '$durationSeconds' },
            sessionsCount: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: limit }
      ])
      .exec();
  }

  async getTeamCurrentWeekStats(teamId: string) {
    const weekKey = this.getCurrentWeekKey();
    const model = this.attendanceService.getModel();
    const rows = await model
      .aggregate([
        { $match: { teamId, weekKey, status: { $ne: 'active' } } },
        {
          $group: {
            _id: '$userId',
            totalDurationSeconds: { $sum: '$durationSeconds' },
            sessionsCount: { $sum: 1 }
          }
        },
        { $sort: { totalDurationSeconds: -1 } }
      ])
      .exec();

    const userIds = rows.map((row) => row._id);
    const users = await this.usersService.findByIds(userIds);
    const userMap = new Map(users.map((user) => [user.id, user]));

    return rows.map((row) => ({
      userId: row._id,
      totalDurationSeconds: row.totalDurationSeconds,
      sessionsCount: row.sessionsCount,
      displayName: userMap.get(row._id)?.displayName ?? '未知成员',
      role: userMap.get(row._id)?.role ?? 'member',
      weekKey
    }));
  }

  async getMemberWeeklyStats(currentUserTeamId: string, memberId: string, limit = 6) {
    const member = await this.usersService.findById(memberId);
    if (!member) {
      throw new NotFoundException({ message: '��Ա������' });
    }
    if (member.teamId !== currentUserTeamId) {
      throw new ForbiddenException({
        code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN,
        message: '���ɲ鿴�����Ŷӳ�Ա'
      });
    }

    return this.getMyWeeklyStats(member.id, limit);
  }

  private getCurrentWeekKey() {
    const now = DateTime.now().setZone(TIMEZONE);
    const weekStart = now.startOf('day').minus({ days: now.weekday - 1 });
    return weekStart.toFormat('yyyy-LL-dd');
  }
}
