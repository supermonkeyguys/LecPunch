import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemberRecordsPage } from './MemberRecordsPage';

const mocks = vi.hoisted(() => ({
  getMemberRecords: vi.fn(),
  updateAdminRecordMark: vi.fn(),
  deleteAdminRecord: vi.fn(),
  getMemberWeeklyStats: vi.fn(),
  showToast: vi.fn(),
  useRootStore: vi.fn()
}));

vi.mock('@/features/records/records.api', () => ({
  getMyRecords: vi.fn(),
  getMemberRecords: mocks.getMemberRecords,
  updateAdminRecordMark: mocks.updateAdminRecordMark,
  deleteAdminRecord: mocks.deleteAdminRecord
}));

vi.mock('@/features/stats/stats.api', () => ({
  getTeamCurrentWeekStats: vi.fn(),
  getMyWeeklyStats: vi.fn(),
  getMemberWeeklyStats: mocks.getMemberWeeklyStats
}));

vi.mock('@/app/store/root-store', () => ({
  useRootStore: mocks.useRootStore
}));

vi.mock('@/shared/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/shared/ui/toast')>('@/shared/ui/toast');
  return {
    ...actual,
    showToast: mocks.showToast
  };
});

describe('MemberRecordsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useRootStore.mockImplementation((selector: (state: { auth: { user: { role: string } | null } }) => unknown) =>
      selector({ auth: { user: { role: 'member' } } })
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state before member detail requests resolve', () => {
    mocks.getMemberRecords.mockReturnValue(new Promise(() => undefined));
    mocks.getMemberWeeklyStats.mockReturnValue(new Promise(() => undefined));

    render(
      <MemoryRouter initialEntries={['/members/member-key-1/records']}>
        <Routes>
          <Route path="/members/:memberKey/records" element={<MemberRecordsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/正在加载成员记录/i)).toBeInTheDocument();
  });

  it('shows error state when member detail requests fail', async () => {
    mocks.getMemberRecords.mockRejectedValue(new Error('boom'));
    mocks.getMemberWeeklyStats.mockRejectedValue(new Error('boom'));

    render(
      <MemoryRouter initialEntries={['/members/member-key-1/records']}>
        <Routes>
          <Route path="/members/:memberKey/records" element={<MemberRecordsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/加载成员记录失败/i)).toBeInTheDocument();
  });

  it('renders selected member records and weekly summary', async () => {
    mocks.getMemberRecords.mockResolvedValue([
      {
        id: 'session-1',
        checkInAt: '2026-04-02T01:00:00.000Z',
        checkOutAt: '2026-04-02T03:00:00.000Z',
        durationSeconds: 7200,
        status: 'completed',
        isMarked: false,
        weekKey: '2026-03-31'
      }
    ]);
    mocks.getMemberWeeklyStats.mockResolvedValue({
      member: { memberKey: 'member-key-1', displayName: 'Alice', role: 'member' },
      items: [
        {
          weekKey: '2026-03-31',
          totalDurationSeconds: 7200,
          sessionsCount: 2
        }
      ]
    });

    render(
      <MemoryRouter initialEntries={['/members/member-key-1/records']}>
        <Routes>
          <Route path="/members/:memberKey/records" element={<MemberRecordsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findAllByText(/Alice/i)).not.toHaveLength(0);
    expect(screen.getAllByText('2026-03-31').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('02:00:00').length).toBeGreaterThanOrEqual(1);
  });

  it('shows admin actions and updates marked records', async () => {
    mocks.useRootStore.mockImplementation((selector: (state: { auth: { user: { role: string } | null } }) => unknown) =>
      selector({ auth: { user: { role: 'admin' } } })
    );
    mocks.getMemberRecords.mockResolvedValue([
      {
        id: 'session-1',
        checkInAt: '2026-04-02T01:00:00.000Z',
        checkOutAt: '2026-04-02T03:00:00.000Z',
        durationSeconds: 7200,
        status: 'completed',
        isMarked: false,
        weekKey: '2026-03-31'
      }
    ]);
    mocks.getMemberWeeklyStats.mockResolvedValue({
      member: { memberKey: 'member-key-1', displayName: 'Alice', role: 'member' },
      items: []
    });
    mocks.updateAdminRecordMark.mockResolvedValue({
      id: 'session-1',
      checkInAt: '2026-04-02T01:00:00.000Z',
      checkOutAt: '2026-04-02T03:00:00.000Z',
      durationSeconds: 7200,
      status: 'completed',
      isMarked: true,
      weekKey: '2026-03-31'
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/members/member-key-1/records']}>
        <Routes>
          <Route path="/members/:memberKey/records" element={<MemberRecordsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/Alice/i);
    await user.click(screen.getByRole('button', { name: /标记/i }));

    await waitFor(() => {
      expect(mocks.updateAdminRecordMark).toHaveBeenCalledWith('session-1', true);
    });
    expect(await screen.findByText('已标记')).toBeInTheDocument();
  });

  it('requires modal confirmation before deleting admin records', async () => {
    mocks.useRootStore.mockImplementation((selector: (state: { auth: { user: { role: string } | null } }) => unknown) =>
      selector({ auth: { user: { role: 'admin' } } })
    );
    mocks.getMemberRecords.mockResolvedValue([
      {
        id: 'session-1',
        checkInAt: '2026-04-02T01:00:00.000Z',
        checkOutAt: '2026-04-02T03:00:00.000Z',
        durationSeconds: 7200,
        status: 'completed',
        isMarked: false,
        weekKey: '2026-03-31'
      }
    ]);
    mocks.getMemberWeeklyStats.mockResolvedValue({
      member: { memberKey: 'member-key-1', displayName: 'Alice', role: 'member' },
      items: []
    });
    mocks.deleteAdminRecord.mockResolvedValue(undefined);

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/members/member-key-1/records']}>
        <Routes>
          <Route path="/members/:memberKey/records" element={<MemberRecordsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/Alice/i);
    await user.click(screen.getByRole('button', { name: /删除/i }));
    expect(screen.getByText(/确认删除打卡记录/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText('确认语句'), '我确认要删除这条打卡记录，且该操作不可恢复');
    await user.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(mocks.deleteAdminRecord).toHaveBeenCalledWith('session-1');
    });
  });
});
