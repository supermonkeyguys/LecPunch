import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ERROR_CODES } from '@lecpunch/shared';
import { TeamLedgerService } from './team-ledger.service';

const create = vi.fn();
const find = vi.fn();
const aggregate = vi.fn();
const findById = vi.fn();
const findOneAndUpdate = vi.fn();

const createService = () =>
  new TeamLedgerService({
    create,
    find,
    aggregate,
    findById,
    findOneAndUpdate
  } as any);

describe('TeamLedgerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates ledger entries with normalized text fields', async () => {
    create.mockResolvedValue({
      id: 'ledger-1',
      teamId: 'team-1',
      type: 'expense',
      amountCents: 5200,
      category: 'snacks',
      counterparty: '便利店'
    });

    const service = createService();
    await service.createEntry({
      teamId: 'team-1',
      occurredAt: '2026-05-01T10:00:00.000Z',
      type: 'expense',
      amountCents: 5200,
      category: '  snacks  ',
      counterparty: '  便利店  ',
      note: '  团队加餐  ',
      proofFileName: '  invoice.png  ',
      proofFileMimeType: '  image/png  ',
      proofFileBase64: 'ZmFrZS1wcm9vZi1iYXNlNjQ=',
      createdBy: 'admin-1'
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        type: 'expense',
        status: 'active',
        amountCents: 5200,
        category: 'snacks',
        counterparty: '便利店',
        note: '团队加餐',
        proofFileName: 'invoice.png',
        proofFileMimeType: 'image/png',
        proofFileBase64: 'ZmFrZS1wcm9vZi1iYXNlNjQ=',
        createdBy: 'admin-1'
      })
    );
  });

  it('lists entries with date/type/category filters', async () => {
    const exec = vi.fn().mockResolvedValue([]);
    const limit = vi.fn().mockReturnValue({ exec });
    const sort = vi.fn().mockReturnValue({ limit });
    find.mockReturnValue({ sort });

    const service = createService();
    await service.listEntries('team-1', {
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.000Z',
      type: 'income',
      category: 'dues',
      limit: 50
    });

    expect(find).toHaveBeenCalledWith({
      teamId: 'team-1',
      type: 'income',
      status: 'active',
      category: 'dues',
      occurredAt: {
        $gte: new Date('2026-05-01T00:00:00.000Z'),
        $lte: new Date('2026-05-31T23:59:59.000Z')
      }
    });
    expect(sort).toHaveBeenCalledWith({ occurredAt: -1, createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(50);
  });

  it('clamps list limit into [1, 500]', async () => {
    const exec = vi.fn().mockResolvedValue([]);
    const limit = vi.fn().mockReturnValue({ exec });
    const sort = vi.fn().mockReturnValue({ limit });
    find.mockReturnValue({ sort });

    const service = createService();
    await service.listEntries('team-1', { limit: 0 });
    await service.listEntries('team-1', { limit: 999 });

    expect(limit).toHaveBeenNthCalledWith(1, 1);
    expect(limit).toHaveBeenNthCalledWith(2, 500);
  });

  it('summarizes entries into income/expense/net totals', async () => {
    const exec = vi.fn().mockResolvedValue([
      {
        incomeCents: 30000,
        expenseCents: 12000,
        entryCount: 4
      }
    ]);
    aggregate.mockReturnValue({ exec });

    const service = createService();
    const summary = await service.summarize('team-1', {
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.000Z'
    });

    expect(summary).toEqual({
      incomeCents: 30000,
      expenseCents: 12000,
      netCents: 18000,
      entryCount: 4
    });
    expect(aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: {
            teamId: 'team-1',
            status: 'active',
            occurredAt: {
              $gte: new Date('2026-05-01T00:00:00.000Z'),
              $lte: new Date('2026-05-31T23:59:59.000Z')
            }
          }
        }
      ])
    );
  });

  it('returns day trend items with net totals using Asia/Shanghai buckets', async () => {
    const exec = vi.fn().mockResolvedValue([
      {
        _id: '2026-05-01',
        incomeCents: 30000,
        expenseCents: 12000,
        entryCount: 4
      }
    ]);
    aggregate.mockReturnValue({ exec });

    const service = createService();
    const items = await service.getTrend('team-1', {
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.000Z'
    });

    expect(items).toEqual([
      {
        bucketKey: '2026-05-01',
        incomeCents: 30000,
        expenseCents: 12000,
        netCents: 18000,
        entryCount: 4
      }
    ]);
    expect(aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: {
            teamId: 'team-1',
            status: 'active',
            occurredAt: {
              $gte: new Date('2026-05-01T00:00:00.000Z'),
              $lte: new Date('2026-05-31T23:59:59.000Z')
            }
          }
        },
        {
          $group: expect.objectContaining({
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$occurredAt',
                timezone: 'Asia/Shanghai'
              }
            }
          })
        }
      ])
    );
  });

  it('supports week granularity and all status in trend queries', async () => {
    const exec = vi.fn().mockResolvedValue([]);
    aggregate.mockReturnValue({ exec });

    const service = createService();
    await service.getTrend('team-1', {
      status: 'all',
      granularity: 'week'
    });

    expect(aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: {
            teamId: 'team-1'
          }
        },
        {
          $group: expect.objectContaining({
            _id: {
              $dateToString: {
                format: '%G-W%V',
                date: '$occurredAt',
                timezone: 'Asia/Shanghai'
              }
            }
          })
        }
      ])
    );
  });

  it('voids entries with trace metadata and keeps operation append-safe', async () => {
    findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        id: 'ledger-1',
        teamId: 'team-1',
        status: 'active'
      })
    });
    findOneAndUpdate.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        id: 'ledger-1',
        teamId: 'team-1',
        status: 'voided',
        voidedBy: 'admin-1',
        voidReason: 'duplicate'
      })
    });

    const service = createService();
    await service.voidEntry('team-1', 'ledger-1', { voidedBy: 'admin-1', reason: 'duplicate' });

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'ledger-1', teamId: 'team-1' },
      {
        $set: expect.objectContaining({
          status: 'voided',
          voidedBy: 'admin-1',
          voidReason: 'duplicate'
        })
      },
      { new: true }
    );
  });

  it('creates reversal entries linked to the source entry', async () => {
    findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        id: 'ledger-1',
        teamId: 'team-1',
        type: 'income',
        amountCents: 10000,
        category: 'dues',
        counterparty: 'member'
      })
    });
    create.mockResolvedValue({
      id: 'ledger-2',
      teamId: 'team-1',
      type: 'expense',
      reversalOfEntryId: 'ledger-1'
    });

    const service = createService();
    await service.createReversal('team-1', 'ledger-1', { createdBy: 'admin-2', note: 'refund' });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        type: 'expense',
        amountCents: 10000,
        category: 'dues',
        reversalOfEntryId: 'ledger-1',
        createdBy: 'admin-2',
        note: 'refund'
      })
    );
  });

  it('rejects cross-team void attempts', async () => {
    findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        id: 'ledger-1',
        teamId: 'team-2',
        status: 'active'
      })
    });

    const service = createService();
    await expect(service.voidEntry('team-1', 'ledger-1', { voidedBy: 'admin-1' })).rejects.toBeInstanceOf(
      ForbiddenException
    );

    try {
      await service.voidEntry('team-1', 'ledger-1', { voidedBy: 'admin-1' });
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN
        }
      });
    }
  });
});
