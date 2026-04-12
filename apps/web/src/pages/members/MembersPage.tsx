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

type SortOption = 'duration-desc' | 'duration-asc' | 'count-desc' | 'count-asc';

const SORTERS: Record<SortOption, (left: TeamWeeklyStatItem, right: TeamWeeklyStatItem) => number> = {
  'duration-desc': (left, right) => right.totalDurationSeconds - left.totalDurationSeconds,
  'duration-asc': (left, right) => left.totalDurationSeconds - right.totalDurationSeconds,
  'count-desc': (left, right) => right.sessionsCount - left.sessionsCount,
  'count-asc': (left, right) => left.sessionsCount - right.sessionsCount
};

export const MembersPage = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamWeeklyStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedEnrollYear, setSelectedEnrollYear] = useState('all');
  const [minimumHours, setMinimumHours] = useState('');
  const [maximumHours, setMaximumHours] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('duration-desc');
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

  const enrollYearOptions = useMemo(
    () => [...new Set(members.map((member) => member.enrollYear))].filter(Boolean).sort((left, right) => right - left),
    [members]
  );

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const minimumSeconds = minimumHours === '' ? null : Math.max(Number(minimumHours) || 0, 0) * 3600;
    const maximumSeconds = maximumHours === '' ? null : Math.max(Number(maximumHours) || 0, 0) * 3600;

    return [...members]
      .filter((member) => (selectedEnrollYear === 'all' ? true : String(member.enrollYear) === selectedEnrollYear))
      .filter((member) => (normalizedSearch ? member.displayName.toLowerCase().includes(normalizedSearch) : true))
      .filter((member) => (minimumSeconds === null ? true : member.totalDurationSeconds >= minimumSeconds))
      .filter((member) => (maximumSeconds === null ? true : member.totalDurationSeconds <= maximumSeconds))
      .sort((left, right) => {
        const result = SORTERS[sortBy](left, right);
        if (result !== 0) {
          return result;
        }

        return left.displayName.localeCompare(right.displayName);
      });
  }, [maximumHours, members, minimumHours, search, selectedEnrollYear, sortBy]);

  const columns: ColumnDef<MembersTableRow>[] = [
    {
      key: 'displayName',
      header: '排序 / 成员',
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
      key: 'enrollYear',
      header: '成员年级',
      render: (value) => <span className="font-medium text-gray-700">{value ? `${value} 级` : '-'}</span>
    },
    {
      key: 'totalDurationSeconds',
      header: '打卡时长',
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
          查看流水
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
          <p className="mt-1 text-sm text-gray-500">查看本周团队成员的累计打卡时长、次数和成员明细。</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="info">仅本周</Badge>
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索成员..."
              aria-label="member-search"
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
          <div className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px_160px_220px]">
              <label className="block sm:hidden">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">搜索</span>
                <input
                  type="text"
                  aria-label="member-search-mobile"
                  placeholder="搜索成员..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-[38px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">年级筛选</span>
                <select
                  aria-label="grade-filter"
                  value={selectedEnrollYear}
                  onChange={(event) => setSelectedEnrollYear(event.target.value)}
                  className="h-[38px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全部年级</option>
                  {enrollYearOptions.map((year) => (
                    <option key={year} value={String(year)}>
                      {year} 级
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">最低时长 (小时)</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  aria-label="minimum-hours-filter"
                  value={minimumHours}
                  onChange={(event) => setMinimumHours(event.target.value)}
                  className="h-[38px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">最高时长 (小时)</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  aria-label="maximum-hours-filter"
                  value={maximumHours}
                  onChange={(event) => setMaximumHours(event.target.value)}
                  className="h-[38px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">排序方式</span>
                <select
                  aria-label="members-sort"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                  className="h-[38px] w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="duration-desc">打卡时长 从高到低</option>
                  <option value="duration-asc">打卡时长 从低到高</option>
                  <option value="count-desc">打卡次数 从高到低</option>
                  <option value="count-asc">打卡次数 从低到高</option>
                </select>
              </label>
            </div>

            <DataTable
              columns={columns}
              data={tableData}
              loading={loading}
              emptyText="暂无符合条件的成员数据"
              rowKey={(member) => member.userId}
            />
          </div>
        )}
      </PageSection>
    </div>
  );
};
