import { useCallback, useMemo, useState } from 'react';
import { CalendarClock, Search } from 'lucide-react';
import { Badge, Button, DataTable, type ColumnDef } from '@lecpunch/ui';
import type { TeamEvent, TeamEventStatus } from '@lecpunch/shared';
import { getTeamEvents } from '@/features/team-events/team-events.api';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { formatDateTime } from '@/shared/lib/time';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';

interface TeamEventRow extends TeamEvent {
  _actions: null;
}

const toStatusBadge = (status: TeamEventStatus) => {
  if (status === 'done') {
    return <Badge variant="success">done</Badge>;
  }
  if (status === 'cancelled') {
    return <Badge variant="warning">cancelled</Badge>;
  }
  return <Badge variant="info">planned</Badge>;
};

export const EventsPage = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TeamEventStatus>('all');

  const fetchEvents = useCallback(async (_signal: AbortSignal) => {
    return getTeamEvents({ limit: 100 });
  }, []);
  const { data: events, loading, error, refresh } = useAsyncData(fetchEvents, [], {
    initialData: [] as TeamEvent[]
  });

  const loadError = error ? getApiErrorMessage(error, '加载团队活动失败') : null;

  const filteredEvents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return events.filter((event) => {
      if (statusFilter !== 'all' && event.status !== statusFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [event.title, event.description].filter(Boolean).some((item) => String(item).toLowerCase().includes(keyword));
    });
  }, [events, search, statusFilter]);

  const columns: ColumnDef<TeamEventRow>[] = [
    {
      key: 'title',
      header: '活动标题',
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'eventAt',
      header: '活动时间',
      render: (value) => <span className="text-sm text-gray-700">{formatDateTime(String(value))}</span>
    },
    {
      key: 'status',
      header: '状态',
      render: (value) => toStatusBadge(value as TeamEventStatus)
    },
    {
      key: 'description',
      header: '说明',
      render: (value) => (value ? <span className="text-sm text-gray-600">{value}</span> : <span className="text-sm text-gray-400">-</span>)
    },
    {
      key: 'updatedAt',
      header: '更新时间',
      render: (value) => <span className="text-sm text-gray-600">{formatDateTime(String(value))}</span>
    }
  ];

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-sm text-blue-700">
          <CalendarClock className="h-4 w-4" />
          团队活动
        </div>
        <h1 className="text-2xl font-bold text-gray-900">近期活动</h1>
        <p className="mt-1 text-sm text-gray-500">查看团队已发布的活动安排与历史状态。</p>
      </div>

      <PageSection padded className="mb-6">
        <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              aria-label="活动搜索"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="按标题、说明搜索"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            aria-label="状态筛选"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | TeamEventStatus)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">全部</option>
            <option value="planned">planned</option>
            <option value="done">done</option>
            <option value="cancelled">cancelled</option>
          </select>

          <Button variant="outline" size="sm" onClick={refresh}>
            重新加载
          </Button>
        </div>
      </PageSection>

      <PageSection>
        {loadError ? (
          <PageState
            tone="error"
            title={loadError}
            description="请稍后重试。"
            action={
              <Button variant="outline" size="sm" onClick={refresh}>
                重新加载
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredEvents.map((event) => ({ ...event, _actions: null }))}
            loading={loading}
            emptyText="暂无活动记录"
            rowKey={(event) => event.id}
          />
        )}
      </PageSection>
    </div>
  );
};
