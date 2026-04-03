import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/shared/ui/card';
import { formatDuration } from '@/shared/lib/time';
import { getMemberRecords } from '@/features/records/records.api';
import { getMemberWeeklyStats } from '@/features/stats/stats.api';
import type { AttendanceSession, WeeklyStatItem } from '@lecpunch/shared';

export const MemberRecordsPage = () => {
  const { userId } = useParams();
  const [records, setRecords] = useState<AttendanceSession[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [recordsData, weeklyData] = await Promise.all([
          getMemberRecords(userId),
          getMemberWeeklyStats(userId)
        ]);
        setRecords(recordsData);
        setWeeklyStats(weeklyData);
      } catch {
        setError('加载成员记录失败');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [userId]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500">成员 ID</p>
        <h1 className="text-2xl font-semibold text-gray-900">{userId ?? '未选择成员'}</h1>
      </div>

      {loading ? <Card className="p-6 text-sm text-slate-500">正在加载成员记录...</Card> : null}
      {error ? <Card className="p-6 text-sm text-red-600">{error}</Card> : null}

      {!loading && !error ? (
        <>
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-900">周统计</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {weeklyStats.map((item) => (
                <div key={item.weekKey} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span>{item.weekKey}</span>
                  <span>{formatDuration(item.totalDurationSeconds)}</span>
                </div>
              ))}
              {weeklyStats.length === 0 ? <p>暂无周统计</p> : null}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">周标识</th>
                  <th className="px-4 py-3">上卡时间</th>
                  <th className="px-4 py-3">时长</th>
                  <th className="px-4 py-3">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3">{record.weekKey}</td>
                    <td className="px-4 py-3">{record.checkInAt}</td>
                    <td className="px-4 py-3">{formatDuration(record.durationSeconds ?? 0)}</td>
                    <td className="px-4 py-3">{record.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </div>
  );
};
