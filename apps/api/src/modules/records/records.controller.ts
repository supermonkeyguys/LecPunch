import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RecordsService } from './records.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';

@Controller('records')
@UseGuards(JwtAuthGuard)
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get('me')
  async myRecords(
    @CurrentUser() user: AuthUser,
    @Query('weekKey') weekKey?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20'
  ) {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const sizeNum = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);
    const records = await this.recordsService.listMyRecords(user.userId, weekKey, pageNum, sizeNum);
    return records.map(this.mapSession);
  }

  @Get('member/:userId')
  async memberRecords(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Query('weekKey') weekKey?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20'
  ) {
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const sizeNum = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);
    const records = await this.recordsService.listMemberRecords(user, userId, weekKey, pageNum, sizeNum);
    return records.map(this.mapSession);
  }

  private mapSession(session: any) {
    return {
      id: session.id,
      userId: session.userId,
      teamId: session.teamId,
      checkInAt: session.checkInAt,
      checkOutAt: session.checkOutAt,
      durationSeconds: session.durationSeconds,
      status: session.status,
      invalidReason: session.invalidReason,
      weekKey: session.weekKey
    };
  }
}
