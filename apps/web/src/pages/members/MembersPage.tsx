import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Search } from 'lucide-react';
import { Badge, Button, DataTable, type ColumnDef } from '@lecpunch/ui';
import { formatDuration } from '@/shared/lib/time';
import { WeekSelector } from '@/app/components/WeekSelector';
import { useRootStore } from '@/app/store/root-store';
import { getTeamCurrentWeekStats } from '@/features/stats/stats.api';
import type { TeamWeeklyStatItem } from '@lecpunch/shared';

export const MembersPage = () => {
  const navigate = useNavigate();
  const selectedWeek = useRootStore((s) => s.selectedWeek);
  const setSelectedWeek = useRootStore((s) => s.setSelectedWeek);
  const [members, setMembers] = useState<TeamWeeklyStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setMembers(await getTeamCurrentWeekStats());
      } catch {
        setError('加载成员统计失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [selectedWeek]);

  const sorted = [...members].sort((a, b) => b.totalDurationSeconds - a.totalDurationSeconds);
  const filtered = search
    ? sorted.filter((m) => m.displayName.toLowerCase().includes(search.toLowerCase()))
    : sorted;

  const columns: ColumnDef<TeamWeeklyStatItem & { _rank: number }>[] = [
    {
      key: '_rank',
      header: '排名 / 成员',
      render: (_, row, idx) => (
        <div className="flex items-center gap-4">
          <span className={`w-6 text-center font-bold text-sm ${idx < 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            {idx + 1}
          </span>
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
            {row.displayName[0]?.toUpperCase()}
          </div>
          <span className="font-bold text-gray-900 text-sm">{row.displayName}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: '角色',
      render: (v) =>
        v === 'admin'
          ? <Badge variant="purple">管理员</Badge>
          : <Badge variant="gray">普通成员</Badge>,
    },
    {
      key: 'totalDurationSeconds',
      header: '本周累计时长',
      cellClassName: 'font-mono font-bold text-gray-800 text-base',
      render: (v) => formatDuration(v),
    },
    {
      key: 'sessionsCount',
      header: '打卡次数',
      render: (v) => `${v} 次`,
    },
    {
      key: '_action',
      header: '',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (_, row) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/members/${row.userId}/records`, {
              state: { displayName: row.displayName, role: row.role },
            });
          }}
        >
          <Eye className="w-4 h-4" />
          查流水
        </Button>
      ),
    },
  ];

  const tableData = filtered.map((m) => ({ ...m, _rank: 0, _action: null }));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">团队数据</h1>
          <p className="text-gray-500 text-sm mt-1">查看团队成员的排行与打卡记录。</p>
        </div>
        <div className="flex items-center gap-3">
          <WeekSelector value={selectedWeek} onChange={setSelectedWeek} />
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="搜索成员..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-[38px]"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {error ? (
          <div className="px-6 py-12 text-center text-red-500">{error}</div>
        ) : (
          <DataTable
            columns={columns as any}
            data={tableData}
            loading={loading}
            emptyText="暂无成员数据"
            rowKey={(r) => r.userId}
          />
        )}
      </div>
    </div>
  );
};
