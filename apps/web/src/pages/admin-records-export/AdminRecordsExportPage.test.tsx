import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminRecordsExportPage } from './AdminRecordsExportPage';

const mocks = vi.hoisted(() => ({
  downloadAdminRecordsExport: vi.fn(),
  showToast: vi.fn()
}));

vi.mock('@/features/records/records.api', () => ({
  getMyRecords: vi.fn(),
  getMemberRecords: vi.fn(),
  downloadAdminRecordsExport: mocks.downloadAdminRecordsExport
}));

vi.mock('@/shared/ui/toast', async () => {
  const actual = await vi.importActual<typeof import('@/shared/ui/toast')>('@/shared/ui/toast');
  return {
    ...actual,
    showToast: mocks.showToast
  };
});

describe('AdminRecordsExportPage', () => {
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const createObjectURL = vi.fn(() => 'blob:records-export');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'URL', {
      writable: true,
      value: {
        createObjectURL,
        revokeObjectURL
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('exports filtered team records and triggers a browser download', async () => {
    mocks.downloadAdminRecordsExport.mockResolvedValue({
      blob: new Blob(['csv-content'], { type: 'text/csv' }),
      filename: 'team-records-2026-04-01_to_2026-04-09.csv'
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminRecordsExportPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-04-09' } });
    await user.click(screen.getByRole('button', { name: '导出团队记录' }));

    await waitFor(() => {
      expect(mocks.downloadAdminRecordsExport).toHaveBeenCalledWith({
        startDate: '2026-04-01',
        endDate: '2026-04-09'
      });
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:records-export');
    expect(mocks.showToast).toHaveBeenCalledWith('导出文件已开始下载');
  });
});
