import { Controller, Get, Param, Patch, Query, Req, Res, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { NotificationsService } from './notifications.service';
import type { Request, Response } from 'express';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  private readonly heartbeatIntervalMs = 30_000;

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

  @Get('stream')
  streamNotifications(@CurrentUser() user: AuthUser, @Req() request: Request, @Res() response: Response) {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    const unsubscribe = this.notificationsService.subscribe(user.userId, (event) => {
      this.writeEvent(response, event.event, event.data);
    });

    this.writeEvent(response, 'connected', this.notificationsService.createConnectedEvent().data);

    const heartbeat = setInterval(() => {
      this.writeEvent(response, 'heartbeat', this.notificationsService.createHeartbeatEvent().data);
    }, this.heartbeatIntervalMs);

    request.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      response.end();
    });
  }

  private writeEvent(response: Response, event: string, data: unknown) {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
