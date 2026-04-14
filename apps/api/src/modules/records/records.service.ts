import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from '../attendance/attendance.service';
import { UsersService } from '../users/users.service';
import { ERROR_CODES } from '@lecpunch/shared';
import type { AuthUser } from '../auth/types/auth-user.type';

export interface TeamRecordExportFilters {
  weekKey?: string;
  startDate?: string;
  endDate?: string;
}

export interface TeamRecordExportRow {
  sessionId: string;
  weekKey: string;
  userId: string;
  username?: string;
  displayName?: string;
  realName?: string;
  studentId?: string;
  enrollYear?: number;
  checkInAt: Date;
  checkOutAt?: Date;
  durationSeconds?: number;
  status: string;
  invalidReason?: string;
}

@Injectable()
export class RecordsService {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly usersService: UsersService
  ) {}

  listMyRecords(
    userId: string,
    filters: TeamRecordExportFilters,
    page: number,
    pageSize: number
  ) {
    return this.attendanceService.listUserRecords(userId, filters, { page, pageSize });
  }

  async listMemberRecords(
    currentUser: AuthUser,
    memberKey: string,
    filters: TeamRecordExportFilters,
    page: number,
    pageSize: number
  ) {
    const member = await this.usersService.findByMemberKey(memberKey);
    if (!member) {
      throw new NotFoundException({ message: '成员不存在' });
    }

    if (member.teamId !== currentUser.teamId) {
      throw new ForbiddenException({
        code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN,
        message: '不可查看其他团队成员'
      });
    }

    return this.attendanceService.listUserRecords(member.id, filters, { page, pageSize });
  }

  async adminUpdateRecordMark(currentUser: AuthUser, recordId: string, isMarked: boolean) {
    this.assertAdmin(currentUser);
    return this.attendanceService.setTeamRecordMarked(currentUser.teamId, recordId, isMarked);
  }

  async adminDeleteRecord(currentUser: AuthUser, recordId: string) {
    this.assertAdmin(currentUser);
    await this.attendanceService.deleteCompletedTeamRecord(currentUser.teamId, recordId);
  }

  async exportTeamRecords(currentUser: AuthUser, filters: TeamRecordExportFilters): Promise<TeamRecordExportRow[]> {
    this.assertAdmin(currentUser);

    const [records, members] = await Promise.all([
      this.attendanceService.listTeamRecords(currentUser.teamId, filters),
      this.usersService.listTeamMembers(currentUser.teamId)
    ]);

    const membersById = new Map(members.map((member) => [member.id, member]));

    return records.map((record) => {
      const member = membersById.get(record.userId);

      return {
        sessionId: record.id,
        weekKey: record.weekKey,
        userId: record.userId,
        username: member?.username,
        displayName: member?.displayName,
        realName: member?.realName,
        studentId: member?.studentId,
        enrollYear: member?.enrollYear,
        checkInAt: record.checkInAt,
        checkOutAt: record.checkOutAt,
        durationSeconds: record.durationSeconds,
        status: record.status,
        invalidReason: record.invalidReason
      };
    });
  }

  private assertAdmin(currentUser: AuthUser) {
    if (currentUser.role !== 'admin') {
      throw new ForbiddenException('Only admins can manage team records');
    }
  }
}
