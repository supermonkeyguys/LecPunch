import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from '../attendance/attendance.service';
import { UsersService } from '../users/users.service';
import { ERROR_CODES } from '@lecpunch/shared';
import type { AuthUser } from '../auth/types/auth-user.type';

@Injectable()
export class RecordsService {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly usersService: UsersService
  ) {}

  listMyRecords(
    userId: string,
    filters: { weekKey?: string; startDate?: string; endDate?: string },
    page: number,
    pageSize: number
  ) {
    return this.attendanceService.listUserRecords(userId, filters, { page, pageSize });
  }

  async listMemberRecords(
    currentUser: AuthUser,
    memberId: string,
    filters: { weekKey?: string; startDate?: string; endDate?: string },
    page: number,
    pageSize: number
  ) {
    const member = await this.usersService.findById(memberId);
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
}
