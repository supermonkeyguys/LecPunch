import { useState } from 'react';
import { Download, Shield } from 'lucide-react';
import { Button } from '@lecpunch/ui';
import { downloadAdminRecordsExport } from '@/features/records/records.api';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { PageSection } from '@/shared/ui/PageSection';
import { showToast } from '@/shared/ui/toast';

const triggerDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export const AdminRecordsExportPage = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);

    try {
      const result = await downloadAdminRecordsExport({
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });

      triggerDownload(result.blob, result.filename);
      showToast('导出文件已开始下载');
    } catch (error) {
      showToast(getApiErrorMessage(error, '导出记录失败'), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-blue-700">
            <Shield className="h-4 w-4" />
            管理后台
          </div>
          <h1 className="text-2xl font-bold text-gray-900">记录导出</h1>
          <p className="mt-1 text-sm text-gray-500">导出当前团队的打卡记录 CSV，可按日期范围筛选。</p>
        </div>

        <Button onClick={() => void handleExport()} disabled={exporting}>
          <Download className="h-4 w-4" />
          {exporting ? '导出中...' : '导出团队记录'}
        </Button>
      </div>

      <PageSection padded>
        <div className="grid gap-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-900">开始日期</span>
            <input
              type="date"
              aria-label="开始日期"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-900">结束日期</span>
            <input
              type="date"
              aria-label="结束日期"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <Button
            type="button"
            variant="outline"
            disabled={exporting || (!startDate && !endDate)}
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
          >
            清除筛选
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">导出范围</p>
            <p className="mt-2 text-sm text-gray-600">
              未选择日期时，将导出当前团队全部打卡记录；设置日期后，按 `Asia/Shanghai` 自然日范围筛选。
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">CSV 列</p>
            <p className="mt-2 text-sm text-gray-600">
              包含成员基础信息、周标识、上下卡时间、时长、状态与作废原因，方便运营留档和二次处理。
            </p>
          </div>
        </div>
      </PageSection>
    </div>
  );
};
