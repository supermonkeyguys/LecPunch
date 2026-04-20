import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ERROR_CODES, TeamLedgerEntryStatus, TeamLedgerType } from '@lecpunch/shared';
import { Model } from 'mongoose';
import { TeamLedgerEntry, TeamLedgerEntryDocument } from './schemas/team-ledger-entry.schema';

export interface ListTeamLedgerEntriesQuery {
  from?: string | Date;
  to?: string | Date;
  type?: TeamLedgerType;
  status?: TeamLedgerEntryStatus | 'all';
  category?: string;
  limit?: number;
}

export interface CreateTeamLedgerEntryInput {
  teamId: string;
  occurredAt: string | Date;
  type: TeamLedgerType;
  amountCents: number;
  category: string;
  counterparty?: string;
  note?: string;
  createdBy: string;
}

export interface VoidTeamLedgerEntryInput {
  voidedBy: string;
  reason?: string;
}

export interface CreateLedgerReversalInput {
  createdBy: string;
  occurredAt?: string | Date;
  note?: string;
}

@Injectable()
export class TeamLedgerService {
  constructor(
    @InjectModel(TeamLedgerEntry.name)
    private readonly teamLedgerEntryModel: Model<TeamLedgerEntryDocument>
  ) {}

  createEntry(input: CreateTeamLedgerEntryInput) {
    const occurredAt = input.occurredAt instanceof Date ? input.occurredAt : new Date(input.occurredAt);
    return this.teamLedgerEntryModel.create({
      teamId: input.teamId,
      occurredAt,
      type: input.type,
      status: 'active',
      amountCents: input.amountCents,
      category: input.category.trim(),
      counterparty: input.counterparty?.trim() || undefined,
      note: input.note?.trim() || undefined,
      createdBy: input.createdBy
    });
  }

  listEntries(teamId: string, query: ListTeamLedgerEntriesQuery = {}) {
    const filter: Record<string, unknown> = { teamId };

    if (query.type) {
      filter.type = query.type;
    }
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    } else if (!query.status) {
      filter.status = 'active';
    }
    if (query.category) {
      filter.category = query.category.trim();
    }
    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) {
        range.$gte = query.from instanceof Date ? query.from : new Date(query.from);
      }
      if (query.to) {
        range.$lte = query.to instanceof Date ? query.to : new Date(query.to);
      }
      filter.occurredAt = range;
    }

    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);

    return this.teamLedgerEntryModel.find(filter).sort({ occurredAt: -1, createdAt: -1 }).limit(limit).exec();
  }

  async voidEntry(teamId: string, entryId: string, input: VoidTeamLedgerEntryInput) {
    const entry = await this.assertTeamOwnership(teamId, entryId);
    if (entry.status === 'voided') {
      return entry;
    }

    const updated = await this.teamLedgerEntryModel
      .findOneAndUpdate(
        { _id: entryId, teamId },
        {
          $set: {
            status: 'voided',
            voidedAt: new Date(),
            voidedBy: input.voidedBy,
            voidReason: input.reason?.trim() || undefined
          }
        },
        { new: true }
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Ledger entry not found');
    }

    return updated;
  }

  async createReversal(teamId: string, entryId: string, input: CreateLedgerReversalInput) {
    const source = await this.assertTeamOwnership(teamId, entryId);
    const occurredAt = input.occurredAt
      ? input.occurredAt instanceof Date
        ? input.occurredAt
        : new Date(input.occurredAt)
      : new Date();
    const reversalType: TeamLedgerType = source.type === 'income' ? 'expense' : 'income';

    return this.teamLedgerEntryModel.create({
      teamId: source.teamId,
      occurredAt,
      type: reversalType,
      status: 'active',
      amountCents: source.amountCents,
      category: source.category,
      counterparty: source.counterparty,
      note: input.note?.trim() || undefined,
      createdBy: input.createdBy,
      reversalOfEntryId: source.id
    });
  }

  private async assertTeamOwnership(teamId: string, entryId: string) {
    const entry = await this.teamLedgerEntryModel.findById(entryId).exec();
    if (!entry) {
      throw new NotFoundException('Ledger entry not found');
    }

    if (entry.teamId !== teamId) {
      throw new ForbiddenException({
        code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN,
        message: 'Cannot access ledger entries from another team'
      });
    }

    return entry;
  }
}
