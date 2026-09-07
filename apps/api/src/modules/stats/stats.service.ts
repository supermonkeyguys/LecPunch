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

  async getMyWeeklyStats(teamId: string, userId: string, enrollYear: number, limit = 6) {
    const model = this.attendanceService.getModel();
    const rows = await model
      .aggregate([
        { $match: { userId, status: { $ne: 'active' } } },
        {
          $group: {
            _id: '$weekKey',
            totalDurationSeconds: { $sum: '$durationSeconds' },
            sessionsCount: { $sum: 1 },
            weeklyGoalSecondsSnapshot: { $max: '$weeklyGoalSecondsSnapshot' }
          }
        },
        { $sort: { _id: -1 } }
      ])
      .exec();

    const adjustmentSummaries = await this.attendanceService.getManualAdjustmentSummaries(teamId, [userId]);

    const rowsByWeek = new Map(rows.map((row) => [row._id, row]));
    for (const key of adjustmentSummaries.keys()) {
      const [adjustmentUserId, weekKey] = key.split(':');
      if (adjustmentUserId === userId && !rowsByWeek.has(weekKey)) {
        rowsByWeek.set(weekKey, { _id: weekKey, totalDurationSeconds: 0, sessionsCount: 0 });
      }
    }

    return [...rowsByWeek.values()]
      .sort((left, right) => right._id.localeCompare(left._id))
      .slice(0, limit)
      .map((row) => {
      const recordedDurationSeconds = row.totalDurationSeconds ?? 0;
      const adjustmentSummary = adjustmentSummaries.get(`${userId}:${row._id}`);
      const manualAdjustmentSeconds = adjustmentSummary?.manualAdjustmentSeconds ?? 0;
      return {
        weekKey: row._id,
        totalDurationSeconds: Math.max(0, recordedDurationSeconds + manualAdjustmentSeconds),
        recordedDurationSeconds,
        manualAdjustmentSeconds,
        adjustmentsCount: adjustmentSummary?.adjustmentsCount ?? 0,
        sessionsCount: row.sessionsCount,
        weeklyGoalSeconds: row.weeklyGoalSecondsSnapshot ?? weeklyGoalSeconds(enrollYear)
      };
    });
  }

  async getTeamCurrentWeekStats(teamId: string, enrollYear?: number) {
    const weekKey = this.getCurrentWeekKey();
    const model = this.attendanceService.getModel();

    const members =
      enrollYear === undefined
        ? await this.usersService.listTeamMembers(teamId)
        : await this.usersService.findByTeamAndEnrollYear(teamId, enrollYear);

    if (members.length === 0) {
      return [];
    }

    const memberIds = members.map((member) => member.id);
    const matchStage: Record<string, unknown> = {
      teamId,
      weekKey,
      status: { $ne: 'active' },
      userId: { $in: memberIds }
    };

    const rows = await model
      .aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$userId',
            totalDurationSeconds: { $sum: '$durationSeconds' },
            sessionsCount: { $sum: 1 }
          }
        }
      ])
      .exec();

    const [adjustmentSummaries] = await Promise.all([
      this.attendanceService.getManualAdjustmentSummaries(teamId, memberIds)
    ]);
    const statsByUserId = new Map(rows.map((row) => [row._id, row]));

    return members
      .map((member) => {
        const stats = statsByUserId.get(member.id);
        const recordedDurationSeconds = stats?.totalDurationSeconds ?? 0;
        const adjustmentSummary = adjustmentSummaries.get(`${member.id}:${weekKey}`);
        const manualAdjustmentSeconds = adjustmentSummary?.manualAdjustmentSeconds ?? 0;
        return {
          memberKey: this.usersService.getMemberKey(member.id),
          totalDurationSeconds: Math.max(0, recordedDurationSeconds + manualAdjustmentSeconds),
          recordedDurationSeconds,
          manualAdjustmentSeconds,
          adjustmentsCount: adjustmentSummary?.adjustmentsCount ?? 0,
          sessionsCount: stats?.sessionsCount ?? 0,
          displayName: member.displayName,
          realName: member.realName,
          role: member.role,
          enrollYear: member.enrollYear,
          avatarColor: member.avatarColor,
          avatarEmoji: member.avatarEmoji,
          avatarBase64: member.avatarBase64,
          weekKey
        };
      })
      .sort(
        (left, right) =>
          right.totalDurationSeconds - left.totalDurationSeconds ||
          right.sessionsCount - left.sessionsCount ||
          left.displayName.localeCompare(right.displayName)
      );
  }

  async getMemberWeeklyStats(currentUserTeamId: string, memberKey: string, limit = 6) {
    const member = await this.usersService.findByMemberKey(memberKey);
    if (!member) {
      throw new NotFoundException({ message: '成员不存在' });
    }
    if (member.teamId !== currentUserTeamId) {
      throw new ForbiddenException({
        code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN,
        message: '不可查看其他团队成员'
      });
    }

    const items = await this.getMyWeeklyStats(currentUserTeamId, member.id, member.enrollYear, limit);
    return {
      member: {
        memberKey,
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
