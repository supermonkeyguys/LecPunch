import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('me/weekly')
  async myWeeklyStats(@CurrentUser() user: AuthUser) {
    const items = await this.statsService.getMyWeeklyStats(user.userId, user.enrollYear);
    return { items, weeklyGoalSeconds: this.statsService.getWeeklyGoalSeconds(user.enrollYear) };
  }

  @Get('team/current-week')
  async teamCurrentWeek(
    @CurrentUser() user: AuthUser,
    @Query('sameGrade') sameGrade?: string
  ) {
    const enrollYear = sameGrade === 'true' ? user.enrollYear : undefined;
    const items = await this.statsService.getTeamCurrentWeekStats(user.teamId, enrollYear);
    return { items };
  }

  @Get('member/:userId/weekly')
  async memberWeeklyStats(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.statsService.getMemberWeeklyStats(user.teamId, userId);
  }
}
