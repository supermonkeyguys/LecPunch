import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemberRecordsPage } from './MemberRecordsPage';

const mocks = vi.hoisted(() => ({
  getMemberRecords: vi.fn(),
  getMemberWeeklyStats: vi.fn()
}));

vi.mock('@/features/records/records.api', () => ({
  getMyRecords: vi.fn(),
  getMemberRecords: mocks.getMemberRecords
}));

vi.mock('@/features/stats/stats.api', () => ({
  getTeamCurrentWeekStats: vi.fn(),
  getMyWeeklyStats: vi.fn(),
  getMemberWeeklyStats: mocks.getMemberWeeklyStats
}));

describe('MemberRecordsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
