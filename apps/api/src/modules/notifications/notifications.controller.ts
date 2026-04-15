import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  async listMyNotifications(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: 'unacked' | 'all',
    @Query('limit') limit = '20'
  ) {
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const items = await this.notificationsService.listForUser(user.teamId, user.userId, {
      status,
      limit: parsedLimit
    });

    return {
      items
    };
  }

  @Patch(':notificationId/ack')
  acknowledgeNotification(@CurrentUser() user: AuthUser, @Param('notificationId') notificationId: string) {
    return this.notificationsService.acknowledge(user.teamId, user.userId, notificationId);
  }
}
