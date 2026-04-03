import { useEffect, useState } from 'react';
import { Card } from '@/shared/ui/card';
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
        const data = await getMyWeeklyStats();
        setWeeklyStats(data);
      } catch {
        setError('加载周历史统计失败');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">周历史统计</h1>
      <Card className="overflow-hidden">
        {loading ? <div className="px-4 py-6 text-center text-slate-500">正在加载周历史统计...</div> : null}
        {error ? <div className="px-4 py-6 text-center text-red-600">{error}</div> : null}
        {!loading && !error ? (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">周标识</th>
                <th className="px-4 py-3">累计时长</th>
                <th className="px-4 py-3">打卡次数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {weeklyStats.map((item) => (
                <tr key={item.weekKey}>
                  <td className="px-4 py-3">{item.weekKey}</td>
                  <td className="px-4 py-3">{formatDuration(item.totalDurationSeconds)}</td>
                  <td className="px-4 py-3">{item.sessionsCount}</td>
                </tr>
              ))}
              {weeklyStats.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    暂无周历史统计
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </Card>
    </div>
  );
};
