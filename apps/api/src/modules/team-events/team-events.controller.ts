import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { CreateTeamEventDto, ListTeamEventsQueryDto, UpdateTeamEventDto } from './dto/team-events-admin.dto';
import { ListTeamEventsMemberQueryDto } from './dto/team-events-member.dto';
import { TeamEventsService } from './team-events.service';

@Controller('team-events')
@UseGuards(JwtAuthGuard)
export class TeamEventsController {
  constructor(private readonly teamEventsService: TeamEventsService) {}

  @Get('events')
  async listMemberEvents(@CurrentUser() user: AuthUser, @Query() query: ListTeamEventsMemberQueryDto) {
    const items = await this.teamEventsService.listEvents(user.teamId, query);
    return { items: items.map((item) => this.mapEvent(item)) };
  }

  @Get('admin/events')
  async listEvents(@CurrentUser() user: AuthUser, @Query() query: ListTeamEventsQueryDto) {
    this.assertAdmin(user);
    const items = await this.teamEventsService.listEvents(user.teamId, query);
    return { items: items.map((item) => this.mapEvent(item)) };
  }

  @Post('admin/events')
  async createEvent(@CurrentUser() user: AuthUser, @Body() dto: CreateTeamEventDto) {
    this.assertAdmin(user);
    const item = await this.teamEventsService.createEvent({
      teamId: user.teamId,
      title: dto.title,
      description: dto.description,
      eventAt: dto.eventAt,
      status: dto.status,
      createdBy: user.userId
    });
    return this.mapEvent(item);
  }

  @Patch('admin/events/:eventId')
  async updateEvent(@CurrentUser() user: AuthUser, @Param('eventId') eventId: string, @Body() dto: UpdateTeamEventDto) {
    this.assertAdmin(user);
    const item = await this.teamEventsService.updateEvent(user.teamId, eventId, {
      ...dto,
      updatedBy: user.userId
    });
    return this.mapEvent(item);
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only admins can manage team events');
    }
  }

  private mapEvent(item: any) {
    return {
      id: item.id,
      teamId: item.teamId,
      title: item.title,
      description: item.description,
      eventAt: item.eventAt instanceof Date ? item.eventAt.toISOString() : item.eventAt,
      status: item.status,
      createdBy: item.createdBy,
      updatedBy: item.updatedBy,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt
    };
  }
}
