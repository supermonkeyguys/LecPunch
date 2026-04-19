import { useCallback, useState } from 'react';
import { Badge, Button, DataTable, type ColumnDef } from '@lecpunch/ui';
import { getMyRecords, type AttendanceRecordItem } from '@/features/records/records.api';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { formatDateTime, formatDuration } from '@/shared/lib/time';
import { DateRangePicker } from '@/shared/ui/DateRangePicker';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';

const statusBadge = (status: string, isMarked: boolean) => {
  const statusNode =
    status === 'completed' ? (
      <Badge variant="success">正常</Badge>
    ) : status === 'invalidated' ? (
      <Badge variant="danger">超时作废</Badge>
    ) : (
      <Badge variant="info">进行中</Badge>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {statusNode}
      {isMarked ? <Badge variant="warning">已标记</Badge> : null}
    </div>
  );
};

const columns: ColumnDef<AttendanceRecordItem>[] = [
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
    header: '本次有效时长',
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
  {
    key: 'status',
    header: '状态',
    render: (_, row) => statusBadge(row.status, row.isMarked)
  }
];

export const RecordsPage = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const fetchRecords = useCallback(
    async (_signal: AbortSignal) =>
      getMyRecords({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        pageSize: 100
      }),
    [endDate, startDate]
  );
  const { data: records, loading, error, refresh } = useAsyncData(fetchRecords, [startDate, endDate], {
    initialData: [] as AttendanceRecordItem[]
  });
  const loadError = error ? getApiErrorMessage(error, '加载打卡记录失败') : null;

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的打卡记录</h1>
          <p className="mt-1 text-sm text-gray-500">时长口径为服务端确认的有效累计时长。</p>
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
        {loadError ? (
          <PageState
            tone="error"
            title={loadError}
            action={
              <Button variant="outline" size="sm" onClick={refresh}>
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
            rowClassName={(record) => (record.isMarked ? 'bg-amber-50/80 hover:bg-amber-100/80' : undefined)}
          />
        )}
      </PageSection>
    </div>
  );
};
