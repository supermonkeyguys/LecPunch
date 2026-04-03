import { useEffect, useState } from 'react';
import { Card } from '@/shared/ui/card';
import { formatDuration } from '@/shared/lib/time';
import { getMyRecords } from '@/features/records/records.api';
import type { AttendanceSession } from '@lecpunch/shared';

export const RecordsPage = () => {
  const [records, setRecords] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMyRecords();
        setRecords(data);
      } catch {
        setError('加载打卡记录失败');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">我的打卡记录</h1>
      <Card className="overflow-hidden">
        {loading ? <div className="px-4 py-6 text-center text-slate-500">正在加载打卡记录...</div> : null}
        {error ? <div className="px-4 py-6 text-center text-red-600">{error}</div> : null}
        {!loading && !error ? (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">周标识</th>
                <th className="px-4 py-3">上卡时间</th>
                <th className="px-4 py-3">下卡时间</th>
                <th className="px-4 py-3">时长</th>
                <th className="px-4 py-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-3">{record.weekKey}</td>
                  <td className="px-4 py-3">{record.checkInAt}</td>
                  <td className="px-4 py-3">{record.checkOutAt ?? '-'}</td>
                  <td className="px-4 py-3">{formatDuration(record.durationSeconds ?? 0)}</td>
                  <td className="px-4 py-3">{record.status}</td>
                </tr>
              ))}
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    暂无打卡记录
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
