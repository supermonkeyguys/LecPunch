import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Search } from 'lucide-react';
import { Badge, Button, DataTable, Input, type ColumnDef } from '@lecpunch/ui';
import type { TeamEvent, TeamEventStatus } from '@lecpunch/shared';
import { createAdminTeamEvent, getAdminTeamEvents, updateAdminTeamEvent } from '@/features/team-events/team-events.api';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { formatDateTime } from '@/shared/lib/time';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';
import { showToast } from '@/shared/ui/toast';

interface AdminTeamEventRow extends TeamEvent {
  _actions: null;
}

type TeamEventFormValues = {
  title: string;
  description: string;
  eventAt: string;
  status: TeamEventStatus;
};

const emptyForm: TeamEventFormValues = {
  title: '',
  description: '',
  eventAt: '',
  status: 'planned'
};

const getCurrentMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const toMonthRangeIso = (monthValue: string) => {
  const [yearRaw, monthRaw] = monthValue.split('-');
  const year = Number.parseInt(yearRaw ?? '', 10);
  const month = Number.parseInt(monthRaw ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return { from: undefined, to: undefined };
  }

  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
};

const toDateTimeLocalInput = (isoValue?: string) => {
  if (!isoValue) {
    return '';
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const toStatusBadge = (status: TeamEventStatus) => {
  if (status === 'done') {
    return <Badge variant="success">done</Badge>;
  }
  if (status === 'cancelled') {
    return <Badge variant="warning">cancelled</Badge>;
  }
  return <Badge variant="info">planned</Badge>;
};

export const AdminEventsPage = () => {
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TeamEventStatus>('all');
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthValue);
  const [editingEvent, setEditingEvent] = useState<TeamEvent | null>(null);
  const [form, setForm] = useState<TeamEventFormValues>(emptyForm);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (_signal: AbortSignal) => {
      const { from, to } = toMonthRangeIso(monthFilter);
      return getAdminTeamEvents({ from, to, limit: 500 });
    },
    [monthFilter]
  );

  const { data: loadedEvents, loading, error, refresh } = useAsyncData(fetchEvents, [monthFilter], {
    initialData: [] as TeamEvent[]
  });

  useEffect(() => {
    setEvents(loadedEvents);
  }, [loadedEvents]);

  const loadError = error ? getApiErrorMessage(error, '加载活动日程失败') : null;

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

  const patchForm = (next: Partial<TeamEventFormValues>) => {
    setForm((current) => ({ ...current, ...next }));
  };

  const resetForm = () => {
    setEditingEvent(null);
    setForm(emptyForm);
  };

  const startEdit = (event: TeamEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description ?? '',
      eventAt: toDateTimeLocalInput(event.eventAt),
      status: event.status
    });
  };

  const submitForm = async () => {
    const title = form.title.trim();
    if (!title) {
      showToast('活动标题不能为空', 'error');
      return;
    }

    if (!form.eventAt) {
      showToast('请填写活动时间', 'error');
      return;
    }

    const eventAt = new Date(form.eventAt);
    if (Number.isNaN(eventAt.getTime())) {
      showToast('活动时间格式不正确', 'error');
      return;
    }

    setSavingEventId(editingEvent?.id ?? 'new');
    try {
      if (editingEvent) {
        const updated = await updateAdminTeamEvent(editingEvent.id, {
          title,
          description: form.description.trim() || undefined,
          eventAt: eventAt.toISOString(),
          status: form.status
        });
        setEvents((current) => current.map((item) => (item.id === editingEvent.id ? updated : item)));
        showToast('活动已更新');
      } else {
        const created = await createAdminTeamEvent({
          title,
          description: form.description.trim() || undefined,
          eventAt: eventAt.toISOString(),
          status: form.status
        });
        setEvents((current) => [created, ...current]);
        showToast('活动已创建');
      }
      resetForm();
    } catch (error) {
      showToast(getApiErrorMessage(error, editingEvent ? '更新活动失败' : '创建活动失败'), 'error');
    } finally {
      setSavingEventId(null);
    }
  };

  const changeStatus = async (event: TeamEvent, status: TeamEventStatus) => {
    if (event.status === status) {
      return;
    }

    setSavingEventId(event.id);
    try {
      const updated = await updateAdminTeamEvent(event.id, { status });
      setEvents((current) => current.map((item) => (item.id === event.id ? updated : item)));
      showToast('活动状态已更新');
      if (editingEvent?.id === event.id) {
        setEditingEvent(updated);
        setForm((current) => ({ ...current, status: updated.status }));
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, '更新活动状态失败'), 'error');
    } finally {
      setSavingEventId(null);
    }
  };

  const columns: ColumnDef<AdminTeamEventRow>[] = [
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
    },
    {
      key: '_actions',
      header: '操作',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (_, row) => {
        const isSaving = savingEventId === row.id;
        return (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={isSaving} onClick={() => startEdit(row)}>
              编辑
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => void changeStatus(row, row.status === 'done' ? 'planned' : 'done')}
            >
              {row.status === 'done' ? '恢复计划' : '标记完成'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => void changeStatus(row, row.status === 'cancelled' ? 'planned' : 'cancelled')}
            >
              {row.status === 'cancelled' ? '恢复计划' : '取消活动'}
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-sm text-blue-700">
          <CalendarClock className="h-4 w-4" />
          管理后台
        </div>
        <h1 className="text-2xl font-bold text-gray-900">团队日程管理</h1>
        <p className="mt-1 text-sm text-gray-500">支持创建活动、更新状态、按月回看历史日程。</p>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <PageSection padded>
          <div className="mb-4 text-sm font-semibold text-gray-900">{editingEvent ? '编辑活动' : '新增活动'}</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              id="event-title"
              label="活动标题"
              value={form.title}
              onChange={(event) => patchForm({ title: event.target.value })}
              placeholder="例：每周例会"
            />
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">活动时间</span>
              <input
                id="event-time"
                aria-label="活动时间"
                type="datetime-local"
                value={form.eventAt}
                onChange={(event) => patchForm({ eventAt: event.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              id="event-description"
              label="活动说明（可选）"
              value={form.description}
              onChange={(event) => patchForm({ description: event.target.value })}
              placeholder="例：同步本周任务进展"
            />
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">活动状态</span>
              <select
                aria-label="活动状态"
                value={form.status}
                onChange={(event) => patchForm({ status: event.target.value as TeamEventStatus })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="planned">planned</option>
                <option value="done">done</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <Button variant="outline" onClick={resetForm} disabled={Boolean(savingEventId)}>
              取消
            </Button>
            <Button onClick={() => void submitForm()} loading={Boolean(savingEventId && (editingEvent ? savingEventId === editingEvent.id : savingEventId === 'new'))}>
              {editingEvent ? '保存修改' : '新增活动'}
            </Button>
          </div>
        </PageSection>

        <PageSection padded>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">筛选与检索</h2>
            <Button variant="outline" size="sm" onClick={refresh}>
              重新加载
            </Button>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">月份</span>
            <input
              type="month"
              aria-label="月份筛选"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-gray-700">状态</span>
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
          </label>

          <div className="relative mt-4">
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
        </PageSection>
      </div>

      <PageSection>
        {loadError ? (
          <PageState
            tone="error"
            title={loadError}
            description="请确认当前账号具备管理员权限，然后重试。"
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
            emptyText="当前筛选条件下暂无活动"
            rowKey={(event) => event.id}
          />
        )}
      </PageSection>
    </div>
  );
};
