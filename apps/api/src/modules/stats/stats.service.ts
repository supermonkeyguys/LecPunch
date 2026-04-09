import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from '../attendance/attendance.service';
import { UsersService } from '../users/users.service';
import { ERROR_CODES, weeklyGoalSeconds } from '@lecpunch/shared';
import { getWeekKey } from '../../common/utils/time.util';

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

  async getTeamCurrentWeekStats(teamId: string, enrollYear?: number) {
    const weekKey = this.getCurrentWeekKey();
    const model = this.attendanceService.getModel();

    // If enrollYear filter is requested, pre-fetch matching userIds
    let allowedUserIds: string[] | undefined;
    if (enrollYear !== undefined) {
      const sameGradeUsers = await this.usersService.findByTeamAndEnrollYear(teamId, enrollYear);
      allowedUserIds = sameGradeUsers.map((u) => u.id);
    }

    const matchStage: Record<string, unknown> = { teamId, weekKey, status: { $ne: 'active' } };
    if (allowedUserIds) {
      matchStage.userId = { $in: allowedUserIds };
    }

    const rows = await model
      .aggregate([
        { $match: matchStage },
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

    return rows.map((row) => {
      const user = userMap.get(row._id);
      return {
        userId: row._id,
        totalDurationSeconds: row.totalDurationSeconds,
        sessionsCount: row.sessionsCount,
        displayName: user?.displayName ?? '未知成员',
        role: user?.role ?? 'member',
        avatarColor: user?.avatarColor,
        avatarEmoji: user?.avatarEmoji,
        avatarBase64: user?.avatarBase64,
        weekKey
      };
    });
  }

  async getMemberWeeklyStats(currentUserTeamId: string, memberId: string, limit = 6) {
    const member = await this.usersService.findById(memberId);
    if (!member) {
      throw new NotFoundException({ message: '成员不存在' });
    }
    if (member.teamId !== currentUserTeamId) {
      throw new ForbiddenException({
        code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN,
        message: '不可查看其他团队成员'
      });
    }

    const items = await this.getMyWeeklyStats(member.id, limit);
    return {
      member: {
        id: member.id,
        displayName: member.displayName,
        role: member.role
      },
      items
    };
  }

  getWeeklyGoalSeconds(enrollYear: number): number {
    return weeklyGoalSeconds(enrollYear);
  }

  private getCurrentWeekKey() {
    return getWeekKey(new Date());
  }
}
