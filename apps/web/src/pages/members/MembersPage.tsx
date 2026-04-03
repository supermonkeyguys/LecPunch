import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/shared/ui/card';
import { formatDuration } from '@/shared/lib/time';
import { getTeamCurrentWeekStats } from '@/features/stats/stats.api';
import type { TeamWeeklyStatItem } from '@lecpunch/shared';

export const MembersPage = () => {
  const [members, setMembers] = useState<TeamWeeklyStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getTeamCurrentWeekStats();
        setMembers(data);
      } catch {
        setError('加载成员统计失败');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">团队成员</h1>
        <p className="text-gray-500">按本周累计时长查看团队成员，并跳转到成员明细记录页。</p>
      </header>

      <Card className="divide-y divide-slate-100 overflow-hidden">
        {loading ? <div className="px-6 py-8 text-sm text-slate-500">正在加载成员统计...</div> : null}
        {error ? <div className="px-6 py-8 text-sm text-red-600">{error}</div> : null}
        {!loading && !error ? (
          members.length > 0 ? (
            members.map((member) => (
              <Link
                key={member.userId}
                to={`/members/${member.userId}/records`}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{member.displayName}</p>
                  <p className="text-sm text-slate-500">{member.role}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900">{formatDuration(member.totalDurationSeconds)}</p>
                  <p className="text-sm text-slate-500">{member.sessionsCount} 次</p>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-6 py-8 text-sm text-slate-500">暂无成员统计数据</div>
          )
        ) : null}
      </Card>
    </div>
  );
};
