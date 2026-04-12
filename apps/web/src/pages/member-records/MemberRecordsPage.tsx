import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Avatar, Badge, Button, DataTable, type ColumnDef } from '@lecpunch/ui';
import type { WeeklyStatItem } from '@lecpunch/shared';
import { getMemberRecords, type AttendanceRecordItem } from '@/features/records/records.api';
import { getMemberWeeklyStats, type MemberWeeklyStatsResponse } from '@/features/stats/stats.api';
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

const recordColumns: ColumnDef<AttendanceRecordItem>[] = [
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
    header: '时长',
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

export const MemberRecordsPage = () => {
  const { memberKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const stateDisplayName: string | undefined = (location.state as { displayName?: string } | null)?.displayName;

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [records, setRecords] = useState<AttendanceRecordItem[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatItem[]>([]);
  const [memberInfo, setMemberInfo] = useState<MemberWeeklyStatsResponse['member'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const memberName = stateDisplayName ?? memberInfo?.displayName ?? '未知成员';

  useEffect(() => {
    if (!memberKey) {
      return;
    }

    let cancelled = false;

    const loadMemberDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const [recordsData, weeklyData] = await Promise.all([
          getMemberRecords(memberKey, { startDate: startDate || undefined, endDate: endDate || undefined }),
          getMemberWeeklyStats(memberKey)
        ]);

        if (cancelled) {
          return;
        }

        setRecords(recordsData);
        setWeeklyStats(weeklyData.items);
        setMemberInfo(weeklyData.member);
      } catch (error) {
        if (!cancelled) {
          setError(getApiErrorMessage(error, '加载成员记录失败'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMemberDetails();

    return () => {
      cancelled = true;
    };
  }, [endDate, memberKey, reloadToken, startDate]);

  const latestStat = weeklyStats[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/members')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <Avatar name={memberName} size="md" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{memberName} 的打卡记录</h1>
            </div>
          </div>
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

      {loading ? (
        <PageSection>
          <PageState tone="loading" title="正在加载成员记录..." />
        </PageSection>
      ) : error ? (
        <PageSection>
          <PageState
            tone="error"
            title={error}
            action={
              <Button variant="outline" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
                重新加载
              </Button>
            }
          />
        </PageSection>
      ) : (
        <>
          {latestStat ? (
            <div className="flex flex-wrap gap-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-sm">
                <span className="text-gray-500">成员：</span>
                <span className="font-medium text-gray-900">{memberName}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">最近一周：</span>
                <span className="font-medium text-gray-900">{latestStat.weekKey}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">累计时长：</span>
                <span className="font-mono text-base font-bold text-blue-600">
                  {formatDuration(latestStat.totalDurationSeconds)}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">打卡次数：</span>
                <span className="font-medium text-gray-900">{latestStat.sessionsCount} 次</span>
              </div>
            </div>
          ) : null}

          <PageSection>
            <DataTable
              columns={recordColumns}
              data={records}
              loading={false}
              emptyText="暂无打卡记录"
              rowKey={(record) => record.id}
            />
          </PageSection>
        </>
      )}
    </div>
  );
};
