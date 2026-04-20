import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { TeamLedgerType } from '@lecpunch/shared';
import { Model } from 'mongoose';
import { TeamLedgerEntry, TeamLedgerEntryDocument } from './schemas/team-ledger-entry.schema';

export interface ListTeamLedgerEntriesQuery {
  from?: string | Date;
  to?: string | Date;
  type?: TeamLedgerType;
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
}
