import { useEffect, useState } from 'react';
import { Badge, Button, DataTable, Progress, type ColumnDef } from '@lecpunch/ui';
import type { WeeklyStatItem } from '@lecpunch/shared';
import { getMyWeeklyStats } from '@/features/stats/stats.api';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { formatDuration, formatWeekRangeLabel, isCurrentWeekKey } from '@/shared/lib/time';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';

export const WeeklyHistoryPage = () => {
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatItem[]>([]);
  const [weeklyGoalSeconds, setWeeklyGoalSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadWeeklyHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await getMyWeeklyStats();

        if (cancelled) {
          return;
        }

        setWeeklyStats(result.items);
        setWeeklyGoalSeconds(result.weeklyGoalSeconds);
      } catch (error) {
        if (!cancelled) {
          setError(getApiErrorMessage(error, '加载周历史统计失败'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadWeeklyHistory();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const columns: ColumnDef<WeeklyStatItem>[] = [
    {
      key: 'weekKey',
      header: '周标识',
      cellClassName: 'font-medium text-gray-900',
      render: (value) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{value}</span>
            {isCurrentWeekKey(value) ? <Badge variant="info">本周</Badge> : null}
          </div>
          <div className="text-xs text-gray-500">{formatWeekRangeLabel(value)}</div>
        </div>
      )
    },
    {
      key: 'totalDurationSeconds',
      header: '累计时长',
      cellClassName: 'font-mono font-bold text-base text-gray-800',
      render: (value) => formatDuration(value)
    },
    { key: 'sessionsCount', header: '打卡次数', render: (value) => `${value} 次` },
    {
      key: '_progress',
      header: '进度',
      headerClassName: 'w-56',
      render: (_, row) => {
        const progress = weeklyGoalSeconds > 0 ? (row.totalDurationSeconds / weeklyGoalSeconds) * 100 : 0;

        return (
          <div className="space-y-2">
            <Progress value={progress} className="w-44" />
            <div className="text-xs text-gray-500">
              {`${Math.round(Math.min(progress, 100))}% / 目标 ${formatDuration(weeklyGoalSeconds)}`}
            </div>
          </div>
        );
      }
    }
  ];

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">周历史统计</h1>
        <p className="mt-1 text-sm text-gray-500">查看你近几周的打卡累计情况和周目标完成进度。</p>
      </div>

      <PageSection>
        {error ? (
          <PageState
            tone="error"
            title={error}
            description="周历史按服务端聚合生成，请稍后重试。"
            action={
              <Button variant="outline" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
                重新加载
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={weeklyStats.map((item) => ({ ...item, _progress: null }))}
            loading={loading}
            emptyText="暂无周历史统计"
            rowKey={(item) => item.weekKey}
          />
        )}
      </PageSection>
    </div>
  );
};
