import { useEffect, useState } from 'react';
import { DataTable, Progress, type ColumnDef } from '@lecpunch/ui';
import { formatDuration } from '@/shared/lib/time';
import { getMyWeeklyStats } from '@/features/stats/stats.api';
import type { WeeklyStatItem } from '@lecpunch/shared';

export const WeeklyHistoryPage = () => {
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getMyWeeklyStats();
        setWeeklyStats(result.items);
      } catch {
        setError('加载周历史统计失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const maxDuration = Math.max(...weeklyStats.map((s) => s.totalDurationSeconds), 1);

  const columns: ColumnDef<WeeklyStatItem>[] = [
    { key: 'weekKey', header: '周标识', cellClassName: 'font-medium text-gray-900' },
    {
      key: 'totalDurationSeconds',
      header: '累计时长',
      cellClassName: 'font-mono font-bold text-gray-800 text-base',
      render: (v) => formatDuration(v),
    },
    { key: 'sessionsCount', header: '打卡次数', render: (v) => `${v} 次` },
    {
      key: '_progress',
      header: '进度',
      headerClassName: 'w-48',
      render: (_, row) => (
        <Progress
          value={(row.totalDurationSeconds / maxDuration) * 100}
          className="w-40"
        />
      ),
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">周历史统计</h1>
        <p className="text-gray-500 text-sm mt-1">查看您近期各周的打卡累计情况。</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {error ? (
          <div className="px-6 py-12 text-center text-red-500">{error}</div>
        ) : (
          <DataTable
            columns={columns}
            data={weeklyStats.map((s) => ({ ...s, _progress: null }))}
            loading={loading}
            emptyText="暂无周历史统计"
            rowKey={(r) => r.weekKey}
          />
        )}
      </div>
    </div>
  );
};
