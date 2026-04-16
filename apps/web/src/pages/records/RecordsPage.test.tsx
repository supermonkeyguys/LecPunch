import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecordsPage } from './RecordsPage';

const mocks = vi.hoisted(() => ({
  getMyRecords: vi.fn()
}));

vi.mock('@/features/records/records.api', () => ({
  getMyRecords: mocks.getMyRecords
}));

describe('RecordsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state before records resolve', () => {
    mocks.getMyRecords.mockReturnValue(new Promise(() => undefined));

    render(
      <MemoryRouter>
        <RecordsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/正在加载/i)).toBeInTheDocument();
  });

  it('shows error state when records request fails', async () => {
    mocks.getMyRecords.mockRejectedValue(new Error('boom'));

    render(
      <MemoryRouter>
        <RecordsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/加载打卡记录失败/i)).toBeInTheDocument();
  });

  it('renders my records from the API', async () => {
    mocks.getMyRecords.mockResolvedValue([
      {
        id: 'session-1',
        checkInAt: '2026-04-02T01:00:00.000Z',
        checkOutAt: '2026-04-02T03:00:00.000Z',
        durationSeconds: 7200,
        status: 'completed',
        weekKey: '2026-03-31'
      }
    ]);

    render(
      <MemoryRouter>
        <RecordsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/2026-03-31/i)).toBeInTheDocument();
    expect(screen.getByText(/02:00:00/i)).toBeInTheDocument();
    expect(screen.getByText(/正常/i)).toBeInTheDocument();
    expect(mocks.getMyRecords).toHaveBeenCalledWith({
      startDate: undefined,
      endDate: undefined,
      pageSize: 100
    });
  });

  it('shows marked records in my records list', async () => {
    mocks.getMyRecords.mockResolvedValue([
      {
        id: 'session-1',
        checkInAt: '2026-04-02T01:00:00.000Z',
        checkOutAt: '2026-04-02T03:00:00.000Z',
        durationSeconds: 7200,
        status: 'completed',
        isMarked: true,
        weekKey: '2026-03-31'
      }
    ]);

    render(
      <MemoryRouter>
        <RecordsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('已标记')).toBeInTheDocument();
  });
});
