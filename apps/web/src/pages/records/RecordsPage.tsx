import { useEffect, useState } from 'react';
import { Badge, DataTable, type ColumnDef } from '@lecpunch/ui';
import { formatDuration, formatDateTime } from '@/shared/lib/time';
import { DateRangePicker } from '@/shared/ui/DateRangePicker';
import { getMyRecords } from '@/features/records/records.api';
import type { AttendanceSession } from '@lecpunch/shared';

function statusBadge(status: string) {
  if (status === 'completed')  return <Badge variant="success">正常</Badge>;
  if (status === 'invalidated') return <Badge variant="danger">超时作废</Badge>;
  return <Badge variant="info">进行中</Badge>;
}

const columns: ColumnDef<AttendanceSession>[] = [
  { key: 'weekKey',   header: '周标识', cellClassName: 'font-medium text-gray-900' },
  { key: 'checkInAt', header: '上卡时间', cellClassName: 'font-mono', render: (v) => formatDateTime(v) },
  {
    key: 'checkOutAt',
    header: '下卡时间',
    cellClassName: 'font-mono',
    render: (v) => (v ? formatDateTime(v) : '-'),
  },
  {
    key: 'durationSeconds',
    header: '本次时长',
    render: (_, row) => (
      <span className={`font-mono font-bold ${row.status === 'invalidated' ? 'text-red-500 line-through' : 'text-gray-900'}`}>
        {formatDuration(row.durationSeconds ?? 0)}
      </span>
    ),
  },
  { key: 'status', header: '状态', render: (v) => statusBadge(v) },
];

export const RecordsPage = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [records, setRecords] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setRecords(await getMyRecords({ startDate: startDate || undefined, endDate: endDate || undefined }));
      } catch {
        setError('加载打卡记录失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [startDate, endDate]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的打卡记录</h1>
          <p className="text-gray-500 text-sm mt-1">查看您的详细打卡流水记录。</p>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onClear={() => { setStartDate(''); setEndDate(''); }}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {error ? (
          <div className="px-6 py-12 text-center text-red-500">{error}</div>
        ) : (
          <DataTable
            columns={columns}
            data={records}
            loading={loading}
            emptyText="该周暂无打卡记录"
            rowKey={(r) => r.id}
          />
        )}
      </div>
    </div>
  );
};
