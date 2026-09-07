import { Body, Controller, ForbiddenException, Get, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { UpsertWeeklyReportReferenceDto } from './dto/upsert-weekly-report-reference.dto';
import { WeeklyReportWeekQueryDto } from './dto/weekly-report-week-query.dto';
import { WeeklyReportsService } from './weekly-reports.service';

@Controller('weekly-reports')
@UseGuards(JwtAuthGuard)
export class WeeklyReportsController {
  constructor(private readonly weeklyReportsService: WeeklyReportsService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthUser, @Query() query: WeeklyReportWeekQueryDto) {
    return this.weeklyReportsService.getMine(user, query.week);
  }

  @Put('me')
  putMine(
    @CurrentUser() user: AuthUser,
    @Query() query: WeeklyReportWeekQueryDto,
    @Body() dto: UpsertWeeklyReportReferenceDto
  ) {
    return this.weeklyReportsService.upsertMine(user, query.week, dto);
  }

  @Get('admin')
  getForAdmin(@CurrentUser() user: AuthUser, @Query() query: WeeklyReportWeekQueryDto) {
    this.assertAdmin(user);
    return this.weeklyReportsService.listForAdmin(user.teamId, query.week);
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only admins can view team weekly reports');
    }
  }
}
