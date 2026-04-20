import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/app/store/auth-store';
import { AdminLedgerPage } from './AdminLedgerPage';

const mocks = vi.hoisted(() => ({
  getAdminTeamLedgerEntries: vi.fn(),
  getAdminTeamLedgerSummary: vi.fn(),
  createAdminTeamLedgerEntry: vi.fn(),
  voidAdminTeamLedgerEntry: vi.fn(),
  createAdminTeamLedgerReversal: vi.fn()
}));

vi.mock('@/features/team-ledger/team-ledger.api', () => ({
  getAdminTeamLedgerEntries: mocks.getAdminTeamLedgerEntries,
  getAdminTeamLedgerSummary: mocks.getAdminTeamLedgerSummary,
  createAdminTeamLedgerEntry: mocks.createAdminTeamLedgerEntry,
  voidAdminTeamLedgerEntry: mocks.voidAdminTeamLedgerEntry,
  createAdminTeamLedgerReversal: mocks.createAdminTeamLedgerReversal
}));

describe('AdminLedgerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    useAuthStore.setState({
      auth: {
        token: 'token',
        user: {
          id: 'admin-1',
          teamId: 'team-1',
          username: 'admin',
          displayName: 'Admin',
          role: 'admin',
          status: 'active',
          enrollYear: 2024,
          createdAt: '2026-04-11T00:00:00.000Z',
          updatedAt: '2026-04-11T00:00:00.000Z'
        }
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads entries and summary cards', async () => {
    mocks.getAdminTeamLedgerEntries.mockResolvedValue([
      {
        id: 'ledger-1',
        teamId: 'team-1',
        occurredAt: '2026-05-01T10:00:00.000Z',
        type: 'income',
        status: 'active',
        amountCents: 10000,
        category: 'dues',
        createdBy: 'admin-1',
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z'
      }
    ]);
    mocks.getAdminTeamLedgerSummary.mockResolvedValue({
      incomeCents: 10000,
      expenseCents: 2000,
      netCents: 8000,
      entryCount: 1
    });

    render(
      <MemoryRouter>
        <AdminLedgerPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('¥100.00')).toBeInTheDocument();
    expect(screen.getByText('¥20.00')).toBeInTheDocument();
    expect(screen.getByText('+¥80.00')).toBeInTheDocument();
    expect(screen.getByText('dues')).toBeInTheDocument();
  });

  it('creates ledger entries with yuan-to-cents conversion', async () => {
    mocks.getAdminTeamLedgerEntries.mockResolvedValue([]);
    mocks.getAdminTeamLedgerSummary.mockResolvedValue({
      incomeCents: 0,
      expenseCents: 0,
      netCents: 0,
      entryCount: 0
    });
    mocks.createAdminTeamLedgerEntry.mockResolvedValue({
      id: 'ledger-new',
      teamId: 'team-1'
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminLedgerPage />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByLabelText('发生时间'), { target: { value: '2026-05-24T18:30' } });
    await user.selectOptions(screen.getByLabelText('流水类型'), 'expense');
    await user.type(screen.getByLabelText('金额（元）'), '12.34');
    await user.type(screen.getByLabelText('分类'), 'snacks');
    await user.click(screen.getByRole('button', { name: '新增流水' }));

    await waitFor(() => {
      expect(mocks.createAdminTeamLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense',
          amountCents: 1234,
          category: 'snacks'
        })
      );
    });
  });
});
