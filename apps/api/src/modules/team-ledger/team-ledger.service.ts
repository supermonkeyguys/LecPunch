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

export interface TeamLedgerSummary {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  entryCount: number;
}

export type TeamLedgerTrendGranularity = 'day' | 'week';

export interface TeamLedgerTrendItem {
  bucketKey: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  entryCount: number;
}

export interface CreateTeamLedgerEntryInput {
  teamId: string;
  occurredAt: string | Date;
  type: TeamLedgerType;
  amountCents: number;
  category: string;
  counterparty?: string;
  note?: string;
  proofFileName?: string;
  proofFileMimeType?: string;
  proofFileBase64?: string;
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
      proofFileName: input.proofFileName?.trim() || undefined,
      proofFileMimeType: input.proofFileMimeType?.trim() || undefined,
      proofFileBase64: input.proofFileBase64 || undefined,
      createdBy: input.createdBy
    });
  }

  listEntries(teamId: string, query: ListTeamLedgerEntriesQuery = {}) {
    const filter = this.buildFilter(teamId, query);
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);

    return this.teamLedgerEntryModel.find(filter).sort({ occurredAt: -1, createdAt: -1 }).limit(limit).exec();
  }

  async summarize(teamId: string, query: Pick<ListTeamLedgerEntriesQuery, 'from' | 'to' | 'status'> = {}): Promise<TeamLedgerSummary> {
    const match = this.buildFilter(teamId, query);
    const [summary] = await this.teamLedgerEntryModel
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            incomeCents: {
              $sum: {
                $cond: [{ $eq: ['$type', 'income'] }, '$amountCents', 0]
              }
            },
            expenseCents: {
              $sum: {
                $cond: [{ $eq: ['$type', 'expense'] }, '$amountCents', 0]
              }
            },
            entryCount: { $sum: 1 }
          }
        }
      ])
      .exec();

    const incomeCents = summary?.incomeCents ?? 0;
    const expenseCents = summary?.expenseCents ?? 0;
    return {
      incomeCents,
      expenseCents,
      netCents: incomeCents - expenseCents,
      entryCount: summary?.entryCount ?? 0
    };
  }

  async getTrend(
    teamId: string,
    query: Pick<ListTeamLedgerEntriesQuery, 'from' | 'to' | 'status'> & { granularity?: TeamLedgerTrendGranularity } = {}
  ): Promise<TeamLedgerTrendItem[]> {
    const match = this.buildFilter(teamId, query);
    const bucketFormat = query.granularity === 'week' ? '%G-W%V' : '%Y-%m-%d';

    const rows = await this.teamLedgerEntryModel
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: bucketFormat,
                date: '$occurredAt',
                timezone: 'Asia/Shanghai'
              }
            },
            incomeCents: {
              $sum: {
                $cond: [{ $eq: ['$type', 'income'] }, '$amountCents', 0]
              }
            },
            expenseCents: {
              $sum: {
                $cond: [{ $eq: ['$type', 'expense'] }, '$amountCents', 0]
              }
            },
            entryCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .exec();

    return rows.map((row) => ({
      bucketKey: row._id,
      incomeCents: row.incomeCents ?? 0,
      expenseCents: row.expenseCents ?? 0,
      netCents: (row.incomeCents ?? 0) - (row.expenseCents ?? 0),
      entryCount: row.entryCount ?? 0
    }));
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

  private buildFilter(teamId: string, query: Pick<ListTeamLedgerEntriesQuery, 'from' | 'to' | 'type' | 'status' | 'category'>) {
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

    return filter;
  }
}
