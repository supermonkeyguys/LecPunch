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

  const goalLabel = weeklyGoalSeconds > 0 ? formatDuration(weeklyGoalSeconds) : '未配置';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">周历史统计</h1>
      </div>

      {!error ? (
        <PageSection padded className="overflow-hidden border-blue-100 bg-gradient-to-r from-blue-50 via-white to-slate-50">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">统计口径</h2>
                <Badge variant="info">当前目标 {goalLabel}</Badge>
              </div>
              <p className="text-sm text-gray-600">用于判断每周进度和次数口径。</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[44rem]">
              <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">周目标</div>
                <div className="mt-2 text-sm font-medium text-gray-900">当前按 {goalLabel} 展示</div>
              </div>
              <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">进度</div>
                <div className="mt-2 text-sm font-medium text-gray-900">所有历史周统一按当前目标计算</div>
              </div>
              <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">作废记录</div>
                <div className="mt-2 text-sm font-medium text-gray-900">次数计入，时长按 0 处理</div>
              </div>
            </div>
          </div>
        </PageSection>
      ) : null}

      <PageSection>
        {error ? (
          <PageState
            tone="error"
            title={error}
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
