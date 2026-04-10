import { useEffect, useState } from 'react';
import { Badge, Button, DataTable, type ColumnDef } from '@lecpunch/ui';
import type { AttendanceSession } from '@lecpunch/shared';
import { getMyRecords } from '@/features/records/records.api';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { formatDateTime, formatDuration } from '@/shared/lib/time';
import { DateRangePicker } from '@/shared/ui/DateRangePicker';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';

const statusBadge = (status: string) => {
  if (status === 'completed') {
    return <Badge variant="success">正常</Badge>;
  }
  if (status === 'invalidated') {
    return <Badge variant="danger">超时作废</Badge>;
  }
  return <Badge variant="info">进行中</Badge>;
};

const columns: ColumnDef<AttendanceSession>[] = [
  { key: 'weekKey', header: '周标识', cellClassName: 'font-medium text-gray-900' },
  {
    key: 'checkInAt',
    header: '上卡时间',
    cellClassName: 'font-mono',
    render: (value) => formatDateTime(value)
  },
  {
    key: 'checkOutAt',
    header: '下卡时间',
    cellClassName: 'font-mono',
    render: (value) => (value ? formatDateTime(value) : '-')
  },
  {
    key: 'durationSeconds',
    header: '本次时长',
    render: (_, row) => (
      <span
        className={`font-mono font-bold ${
          row.status === 'invalidated' ? 'text-red-500 line-through' : 'text-gray-900'
        }`}
      >
        {formatDuration(row.durationSeconds ?? 0)}
      </span>
    )
  },
  { key: 'status', header: '状态', render: (value) => statusBadge(value) }
];

export const RecordsPage = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [records, setRecords] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadRecords = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextRecords = await getMyRecords({
          startDate: startDate || undefined,
          endDate: endDate || undefined
        });

        if (cancelled) {
          return;
        }

        setRecords(nextRecords);
      } catch (error) {
        if (!cancelled) {
          setError(getApiErrorMessage(error, '加载打卡记录失败'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRecords();

    return () => {
      cancelled = true;
    };
  }, [endDate, reloadToken, startDate]);

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的打卡记录</h1>
          <p className="mt-1 text-sm text-gray-500">查看您的详细打卡流水记录。</p>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onClear={() => {
            setStartDate('');
            setEndDate('');
          }}
        />
      </div>

      <PageSection>
        {error ? (
          <PageState
            tone="error"
            title={error}
            description="可以稍后重试，或调整筛选条件后重新加载。"
            action={
              <Button variant="outline" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
                重新加载
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={records}
            loading={loading}
            emptyText="当前筛选条件下暂无打卡记录"
            rowKey={(record) => record.id}
          />
        )}
      </PageSection>
    </div>
  );
};
