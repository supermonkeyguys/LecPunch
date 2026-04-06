import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Badge, Button, Avatar, DataTable, type ColumnDef } from '@lecpunch/ui';
import { formatDuration, formatDateTime } from '@/shared/lib/time';
import { DateRangePicker } from '@/shared/ui/DateRangePicker';
import { getMemberRecords } from '@/features/records/records.api';
import { getMemberWeeklyStats } from '@/features/stats/stats.api';
import type { AttendanceSession, WeeklyStatItem } from '@lecpunch/shared';
import type { MemberWeeklyStatsResponse } from '@/features/stats/stats.api';

function statusBadge(status: string) {
  if (status === 'completed')   return <Badge variant="success">正常</Badge>;
  if (status === 'invalidated') return <Badge variant="danger">超时作废</Badge>;
  return <Badge variant="info">进行中</Badge>;
}

const recordColumns: ColumnDef<AttendanceSession>[] = [
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
    header: '时长',
    render: (_, row) => (
      <span className={`font-mono font-bold ${row.status === 'invalidated' ? 'text-red-500 line-through' : 'text-gray-900'}`}>
        {formatDuration(row.durationSeconds ?? 0)}
      </span>
    ),
  },
  { key: 'status', header: '状态', render: (v) => statusBadge(v) },
];

export const MemberRecordsPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const stateDisplayName: string | undefined = (location.state as any)?.displayName;
  const stateRole: string | undefined = (location.state as any)?.role;

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [records, setRecords] = useState<AttendanceSession[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatItem[]>([]);
  const [memberInfo, setMemberInfo] = useState<MemberWeeklyStatsResponse['member'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const memberName = stateDisplayName ?? memberInfo?.displayName ?? userId ?? '未知成员';
  const memberRole = stateRole ?? memberInfo?.role ?? 'member';

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [recordsData, weeklyData] = await Promise.all([
          getMemberRecords(userId, { startDate: startDate || undefined, endDate: endDate || undefined }),
          getMemberWeeklyStats(userId),
        ]);
        setRecords(recordsData);
        setWeeklyStats(weeklyData.items);
        setMemberInfo(weeklyData.member);
      } catch {
        setError('加载成员记录失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [userId, startDate, endDate]);

  const latestStat = weeklyStats[0];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/members')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <Avatar name={memberName} size="md" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{memberName} 的打卡记录</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {memberRole === 'admin' ? '管理员' : '普通成员'}
              </p>
            </div>
          </div>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onClear={() => { setStartDate(''); setEndDate(''); }}
        />
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
          正在加载成员记录...
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-red-500">
          {error}
        </div>
      ) : (
        <>
          {/* Summary bar */}
          {latestStat && (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 flex flex-wrap gap-6">
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
                <span className="font-bold text-blue-600 font-mono text-base">
                  {formatDuration(latestStat.totalDurationSeconds)}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">打卡次数：</span>
                <span className="font-medium text-gray-900">{latestStat.sessionsCount} 次</span>
              </div>
            </div>
          )}

          {/* Records table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <DataTable
              columns={recordColumns}
              data={records}
              loading={false}
              emptyText="暂无打卡记录"
              rowKey={(r) => r.id}
            />
          </div>
        </>
      )}
    </div>
  );
};
