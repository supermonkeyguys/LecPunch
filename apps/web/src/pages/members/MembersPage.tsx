import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Search } from 'lucide-react';
import { Avatar, Badge, Button, DataTable, type ColumnDef } from '@lecpunch/ui';
import type { TeamWeeklyStatItem } from '@lecpunch/shared';
import { getTeamCurrentWeekStats } from '@/features/stats/stats.api';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { formatDuration } from '@/shared/lib/time';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';

interface MembersTableRow extends TeamWeeklyStatItem {
  _action: null;
}

export const MembersPage = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamWeeklyStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextMembers = await getTeamCurrentWeekStats();

        if (cancelled) {
          return;
        }

        setMembers(nextMembers);
      } catch (error) {
        if (!cancelled) {
          setError(getApiErrorMessage(error, '加载成员统计失败'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const filteredMembers = useMemo(() => {
    const sorted = [...members].sort((left, right) => right.totalDurationSeconds - left.totalDurationSeconds);
    return search
      ? sorted.filter((member) => member.displayName.toLowerCase().includes(search.toLowerCase()))
      : sorted;
  }, [members, search]);

  const columns: ColumnDef<MembersTableRow>[] = [
    {
      key: 'displayName',
      header: '排名 / 成员',
      render: (_, row, index) => (
        <div className="flex items-center gap-4">
          <span className={`w-6 text-center text-sm font-bold ${index < 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            {index + 1}
          </span>
          <Avatar
            name={row.displayName}
            size="sm"
            avatarColor={row.avatarColor}
            avatarEmoji={row.avatarEmoji}
            avatarBase64={row.avatarBase64}
          />
          <span className="text-sm font-bold text-gray-900">{row.displayName}</span>
        </div>
      )
    },
    {
      key: 'role',
      header: '角色',
      render: (value) =>
        value === 'admin' ? <Badge variant="purple">管理员</Badge> : <Badge variant="gray">普通成员</Badge>
    },
    {
      key: 'totalDurationSeconds',
      header: '本周累计时长',
      cellClassName: 'font-mono font-bold text-base text-gray-800',
      render: (value) => formatDuration(value)
    },
    {
      key: 'sessionsCount',
      header: '打卡次数',
      render: (value) => `${value} 次`
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
          className="text-blue-600 hover:bg-blue-50 hover:text-blue-800"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/members/${row.userId}/records`, {
              state: { displayName: row.displayName, role: row.role }
            });
          }}
        >
          <Eye className="h-4 w-4" />
          查流水
        </Button>
      )
    }
  ];

  const tableData: MembersTableRow[] = filteredMembers.map((member) => ({ ...member, _action: null }));

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">团队数据</h1>
          <p className="mt-1 text-sm text-gray-500">查看本周团队成员的排行与打卡记录。</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="info">仅本周</Badge>
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索成员..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-[38px] rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <PageSection>
        {error ? (
          <PageState
            tone="error"
            title={error}
            description="团队榜当前只支持本周视图，请稍后重试。"
            action={
              <Button variant="outline" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
                重新加载
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={tableData}
            loading={loading}
            emptyText="暂无成员数据"
            rowKey={(member) => member.userId}
          />
        )}
      </PageSection>
    </div>
  );
};
