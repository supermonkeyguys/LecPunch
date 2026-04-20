import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamLedgerService } from './team-ledger.service';

const create = vi.fn();
const find = vi.fn();

const createService = () =>
  new TeamLedgerService({
    create,
    find
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
      createdBy: 'admin-1'
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        type: 'expense',
        amountCents: 5200,
        category: 'snacks',
        counterparty: '便利店',
        note: '团队加餐',
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
});
