import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TeamLedgerController } from './team-ledger.controller';

const adminUser: AuthUser = {
  userId: 'admin-1',
  teamId: 'team-1',
  role: 'admin',
  username: 'admin',
  displayName: 'Admin',
  enrollYear: 2024
};

const memberUser: AuthUser = {
  ...adminUser,
  userId: 'member-1',
  role: 'member',
  username: 'member',
  displayName: 'Member'
};

describe('TeamLedgerController', () => {
  const teamLedgerService = {
    listEntries: vi.fn(),
    createEntry: vi.fn(),
    voidEntry: vi.fn(),
    createReversal: vi.fn(),
    summarize: vi.fn()
  };

  let controller: TeamLedgerController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new TeamLedgerController(teamLedgerService as never);
  });

  it('lists entries and returns summary for admin users', async () => {
    teamLedgerService.listEntries.mockResolvedValue([
      {
        id: 'ledger-1',
        teamId: 'team-1',
        occurredAt: new Date('2026-05-01T10:00:00.000Z'),
        type: 'income',
        status: 'active',
        amountCents: 10000,
        category: 'dues',
        createdBy: 'admin-1',
        createdAt: new Date('2026-05-01T10:00:00.000Z'),
        updatedAt: new Date('2026-05-01T10:00:00.000Z')
      }
    ]);
    teamLedgerService.summarize.mockResolvedValue({
      incomeCents: 10000,
      expenseCents: 0,
      netCents: 10000,
      entryCount: 1
    });

    const listResult = await controller.listEntries(adminUser, {
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.000Z',
      status: 'active',
      limit: 50
    });
    const summaryResult = await controller.getSummary(adminUser, {
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.000Z'
    });

    expect(teamLedgerService.listEntries).toHaveBeenCalledWith('team-1', {
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.000Z',
      status: 'active',
      limit: 50
    });
    expect(listResult.items).toHaveLength(1);
    expect(teamLedgerService.summarize).toHaveBeenCalledWith('team-1', {
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.000Z'
    });
    expect(summaryResult.netCents).toBe(10000);
  });

  it('creates, voids, and reverses entries for admins', async () => {
    teamLedgerService.createEntry.mockResolvedValue({ id: 'ledger-1', teamId: 'team-1' });
    teamLedgerService.voidEntry.mockResolvedValue({ id: 'ledger-1', teamId: 'team-1', status: 'voided' });
    teamLedgerService.createReversal.mockResolvedValue({ id: 'ledger-2', teamId: 'team-1', reversalOfEntryId: 'ledger-1' });

    await controller.createEntry(adminUser, {
      occurredAt: '2026-05-01T10:00:00.000Z',
      type: 'income',
      amountCents: 10000,
      category: 'dues'
    });
    await controller.voidEntry(adminUser, 'ledger-1', { reason: 'duplicate' });
    await controller.createReversal(adminUser, 'ledger-1', { note: 'refund' });

    expect(teamLedgerService.createEntry).toHaveBeenCalledWith({
      teamId: 'team-1',
      occurredAt: '2026-05-01T10:00:00.000Z',
      type: 'income',
      amountCents: 10000,
      category: 'dues',
      counterparty: undefined,
      note: undefined,
      createdBy: 'admin-1'
    });
    expect(teamLedgerService.voidEntry).toHaveBeenCalledWith('team-1', 'ledger-1', {
      voidedBy: 'admin-1',
      reason: 'duplicate'
    });
    expect(teamLedgerService.createReversal).toHaveBeenCalledWith('team-1', 'ledger-1', {
      createdBy: 'admin-1',
      occurredAt: undefined,
      note: 'refund'
    });
  });

  it('rejects member access to admin ledger routes', async () => {
    await expect(controller.listEntries(memberUser, { limit: 20 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.createEntry(memberUser, {
        occurredAt: '2026-05-01T10:00:00.000Z',
        type: 'income',
        amountCents: 10000,
        category: 'dues'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.voidEntry(memberUser, 'ledger-1', {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.createReversal(memberUser, 'ledger-1', {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.getSummary(memberUser, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.getExportContract(memberUser, { limit: 20 })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
