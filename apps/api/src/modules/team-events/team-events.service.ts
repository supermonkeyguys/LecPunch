import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ERROR_CODES, TeamEventStatus } from '@lecpunch/shared';
import { Model } from 'mongoose';
import { TeamEvent, TeamEventDocument } from './schemas/team-event.schema';

export interface ListTeamEventsQuery {
  status?: TeamEventStatus;
  from?: string | Date;
  to?: string | Date;
  limit?: number;
}

export interface CreateTeamEventInput {
  teamId: string;
  title: string;
  description?: string;
  eventAt: string | Date;
  status?: TeamEventStatus;
  createdBy: string;
}

export interface UpdateTeamEventInput {
  title?: string;
  description?: string;
  eventAt?: string | Date;
  status?: TeamEventStatus;
  updatedBy: string;
}

@Injectable()
export class TeamEventsService {
  constructor(
    @InjectModel(TeamEvent.name)
    private readonly teamEventModel: Model<TeamEventDocument>
  ) {}

  createEvent(input: CreateTeamEventInput) {
    const eventAt = input.eventAt instanceof Date ? input.eventAt : new Date(input.eventAt);
    return this.teamEventModel.create({
      teamId: input.teamId,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      eventAt,
      status: input.status ?? 'planned',
      createdBy: input.createdBy,
      updatedBy: input.createdBy
    });
  }

  listEvents(teamId: string, query: ListTeamEventsQuery = {}) {
    const filter: Record<string, unknown> = { teamId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) {
        range.$gte = query.from instanceof Date ? query.from : new Date(query.from);
      }
      if (query.to) {
        range.$lte = query.to instanceof Date ? query.to : new Date(query.to);
      }
      filter.eventAt = range;
    }

    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);

    return this.teamEventModel.find(filter).sort({ eventAt: -1, createdAt: -1 }).limit(limit).exec();
  }

  async updateEvent(teamId: string, eventId: string, input: UpdateTeamEventInput) {
    await this.assertTeamOwnership(teamId, eventId);

    const set: Record<string, unknown> = { updatedBy: input.updatedBy };
    if (input.title !== undefined) {
      set.title = input.title.trim();
    }
    if (input.description !== undefined) {
      set.description = input.description.trim() || undefined;
    }
    if (input.eventAt !== undefined) {
      set.eventAt = input.eventAt instanceof Date ? input.eventAt : new Date(input.eventAt);
    }
    if (input.status !== undefined) {
      set.status = input.status;
    }

    const updated = await this.teamEventModel.findOneAndUpdate({ _id: eventId, teamId }, { $set: set }, { new: true }).exec();
    if (!updated) {
      throw new NotFoundException('Team event not found');
    }

    return updated;
  }

  private async assertTeamOwnership(teamId: string, eventId: string) {
    const event = await this.teamEventModel.findById(eventId).exec();
    if (!event) {
      throw new NotFoundException('Team event not found');
    }

    if (event.teamId !== teamId) {
      throw new ForbiddenException({
        code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN,
        message: 'Cannot access team events from another team'
      });
    }
  }
}
