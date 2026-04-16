import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { NetworkPolicyService } from '../network-policy/network-policy.service';
import type { Request } from 'express';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly networkPolicyService: NetworkPolicyService
  ) {}

  @Get('current')
  async getCurrent(@CurrentUser() user: AuthUser) {
    const session = await this.attendanceService.getCurrentSession(user.userId);
    return {
      hasActiveSession: Boolean(session),
      session: session ? this.mapSession(session) : null
    };
  }

  @Get('team-active')
  async getTeamActive(@CurrentUser() user: AuthUser) {
    const items = await this.attendanceService.listTeamActiveSessions(user.teamId);
    return { items };
  }

  @Post('check-in')
  async checkIn(@CurrentUser() user: AuthUser, @Req() request: Request) {
    const ip = await this.networkPolicyService.getClientIp(user.teamId, request);
    const session = await this.attendanceService.checkIn(user, ip);
    return this.mapSession(session);
  }

  @Post('check-out')
  async checkOut(@CurrentUser() user: AuthUser, @Req() request: Request) {
    const ip = await this.networkPolicyService.getClientIp(user.teamId, request);
    const session = await this.attendanceService.checkOut(user, ip);
    return this.mapSession(session);
  }

  @Post('keepalive')
  async keepAlive(@CurrentUser() user: AuthUser, @Req() request: Request) {
    const ip = await this.networkPolicyService.getClientIp(user.teamId, request);
    const session = await this.attendanceService.keepAlive(user, ip);
    return this.mapSession(session);
  }

  private mapSession(session: any) {
    const isPaused = Boolean(session.pauseReason || session.pausedAt);
    return {
      id: session.id,
      teamId: session.teamId,
      userId: session.userId,
      checkInAt: session.checkInAt,
      checkOutAt: session.checkOutAt,
      lastKeepaliveAt: session.lastKeepaliveAt,
      lastCreditedAt: session.lastCreditedAt,
      creditedSeconds: session.creditedSeconds,
      pausedAt: session.pausedAt,
      pauseReason: session.pauseReason,
      isPaused,
      segmentsCount: session.segmentsCount,
      durationSeconds: session.durationSeconds,
      elapsedSeconds: session.elapsedSeconds,
      status: session.status,
      invalidReason: session.invalidReason,
      weekKey: session.weekKey
    };
  }
}
