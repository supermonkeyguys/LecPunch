import { useCallback, useMemo, useState } from 'react';
import { BanknoteArrowDown, BanknoteArrowUp, ReceiptText } from 'lucide-react';
import { Badge, Button, DataTable, Input, type ColumnDef } from '@lecpunch/ui';
import type { TeamLedgerEntry, TeamLedgerType } from '@lecpunch/shared';
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import {
  createAdminTeamLedgerEntry,
  createAdminTeamLedgerReversal,
  getAdminTeamLedgerEntries,
  getAdminTeamLedgerSummary,
  getAdminTeamLedgerTrend,
  type TeamLedgerSummary,
  type TeamLedgerTrendItem,
  voidAdminTeamLedgerEntry
} from '@/features/team-ledger/team-ledger.api';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import {
  CHART_COLORS,
  CHART_TOOLTIP_CONTENT_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  formatCentsAsYuan
} from '@/shared/lib/chart';
import { formatDateTime } from '@/shared/lib/time';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';
import { showToast } from '@/shared/ui/toast';

interface AdminLedgerRow extends TeamLedgerEntry {
  _actions: null;
}

type LedgerFormValues = {
  occurredAt: string;
  type: TeamLedgerType;
  amountYuan: string;
  category: string;
  counterparty: string;
  note: string;
};

interface LedgerPageData {
  entries: TeamLedgerEntry[];
  summary: TeamLedgerSummary;
  trendItems: TeamLedgerTrendItem[];
}

const emptyForm: LedgerFormValues = {
  occurredAt: '',
  type: 'income',
  amountYuan: '',
  category: '',
  counterparty: '',
  note: ''
};

const emptySummary: TeamLedgerSummary = {
  incomeCents: 0,
  expenseCents: 0,
  netCents: 0,
  entryCount: 0
};

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

const formatCurrency = (amountCents: number) => {
  return `¥${(amountCents / 100).toFixed(2)}`;
};

const formatTrendBucketLabel = (bucketKey: string) => {
  if (!bucketKey) {
    return bucketKey;
  }

  if (bucketKey.length === 10) {
    return bucketKey.slice(5);
  }

  return bucketKey;
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

export const AdminLedgerPage = () => {
  const [monthFilter, setMonthFilter] = useState(getCurrentMonthValue);
  const [typeFilter, setTypeFilter] = useState<'all' | TeamLedgerType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'voided'>('active');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState<LedgerFormValues>(emptyForm);
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);

  const fetchData = useCallback(
    async (_signal: AbortSignal): Promise<LedgerPageData> => {
      const { from, to } = toMonthRangeIso(monthFilter);
      const status = statusFilter === 'all' ? 'all' : statusFilter;
      const type = typeFilter === 'all' ? undefined : typeFilter;
      const category = categoryFilter.trim() || undefined;

      const [entries, summary, trendItems] = await Promise.all([
        getAdminTeamLedgerEntries({ from, to, status, type, category, limit: 500 }),
        getAdminTeamLedgerSummary({ from, to, status }),
        getAdminTeamLedgerTrend({ from, to, status, granularity: 'day' })
      ]);

      return { entries, summary, trendItems };
    },
    [monthFilter, typeFilter, statusFilter, categoryFilter]
  );

  const { data, loading, error, refresh } = useAsyncData(fetchData, [monthFilter, typeFilter, statusFilter, categoryFilter], {
    initialData: {
      entries: [] as TeamLedgerEntry[],
      summary: emptySummary,
      trendItems: [] as TeamLedgerTrendItem[]
    }
  });

  const loadError = error ? getApiErrorMessage(error, '加载流水数据失败') : null;
  const trendData = useMemo(
    () =>
      data.trendItems.map((item) => ({
        ...item,
        axisBucketLabel: formatTrendBucketLabel(item.bucketKey)
      })),
    [data.trendItems]
  );

  const patchForm = (next: Partial<LedgerFormValues>) => {
    setForm((current) => ({ ...current, ...next }));
  };

  const submitForm = async () => {
    if (!form.occurredAt) {
      showToast('请填写发生时间', 'error');
      return;
    }

    const occurredAt = new Date(form.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      showToast('发生时间格式不正确', 'error');
      return;
    }

    const category = form.category.trim();
    if (!category) {
      showToast('分类不能为空', 'error');
      return;
    }

    const amountYuan = Number(form.amountYuan);
    if (!Number.isFinite(amountYuan) || amountYuan <= 0) {
      showToast('金额必须大于 0', 'error');
      return;
    }

    const amountCents = Math.round(amountYuan * 100);
    setSavingEntryId('new');
    try {
      await createAdminTeamLedgerEntry({
        occurredAt: occurredAt.toISOString(),
        type: form.type,
        amountCents,
        category,
        counterparty: form.counterparty.trim() || undefined,
        note: form.note.trim() || undefined
      });
      showToast('流水已创建');
      setForm(emptyForm);
      await refresh();
    } catch (error) {
      showToast(getApiErrorMessage(error, '创建流水失败'), 'error');
    } finally {
      setSavingEntryId(null);
    }
  };

  const voidEntry = async (entry: TeamLedgerEntry) => {
    const ok = window.confirm(`确认作废流水 ${entry.id} 吗？`);
    if (!ok) {
      return;
    }

    setSavingEntryId(entry.id);
    try {
      await voidAdminTeamLedgerEntry(entry.id, 'manual_admin_void');
      showToast('流水已作废');
      await refresh();
    } catch (error) {
      showToast(getApiErrorMessage(error, '作废流水失败'), 'error');
    } finally {
      setSavingEntryId(null);
    }
  };

  const reverseEntry = async (entry: TeamLedgerEntry) => {
    const ok = window.confirm(`确认对流水 ${entry.id} 生成冲正记录吗？`);
    if (!ok) {
      return;
    }

    setSavingEntryId(entry.id);
    try {
      await createAdminTeamLedgerReversal(entry.id, `reversal for ${entry.id}`);
      showToast('冲正记录已创建');
      await refresh();
    } catch (error) {
      showToast(getApiErrorMessage(error, '创建冲正记录失败'), 'error');
    } finally {
      setSavingEntryId(null);
    }
  };

  const columns: ColumnDef<AdminLedgerRow>[] = useMemo(
    () => [
      {
        key: 'occurredAt',
        header: '发生时间',
        render: (value) => <span className="text-sm text-gray-700">{formatDateTime(String(value))}</span>
      },
      {
        key: 'type',
        header: '类型',
        render: (value) =>
          value === 'income' ? <Badge variant="success">income</Badge> : <Badge variant="warning">expense</Badge>
      },
      {
        key: 'status',
        header: '状态',
        render: (value) => (value === 'voided' ? <Badge variant="danger">voided</Badge> : <Badge variant="info">active</Badge>)
      },
      {
        key: 'amountCents',
        header: '金额',
        render: (value, row) => (
          <span className={`font-medium ${row.type === 'income' ? 'text-green-700' : 'text-amber-700'}`}>
            {row.type === 'income' ? '+' : '-'}
            {formatCurrency(Number(value))}
          </span>
        )
      },
      {
        key: 'category',
        header: '分类',
        render: (value) => <span className="text-sm text-gray-700">{value}</span>
      },
      {
        key: 'note',
        header: '备注',
        render: (value) => (value ? <span className="text-sm text-gray-600">{value}</span> : <span className="text-sm text-gray-400">-</span>)
      },
      {
        key: '_actions',
        header: '操作',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: (_, row) => {
          if (row.status === 'voided') {
            return <span className="text-xs text-gray-400">已作废</span>;
          }

          const isSaving = savingEntryId === row.id;
          return (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={isSaving} onClick={() => void reverseEntry(row)}>
                冲正
              </Button>
              <Button variant="danger" size="sm" disabled={isSaving} onClick={() => void voidEntry(row)}>
                作废
              </Button>
            </div>
          );
        }
      }
    ],
    [savingEntryId]
  );

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-sm text-blue-700">
          <ReceiptText className="h-4 w-4" />
          管理后台
        </div>
        <h1 className="text-2xl font-bold text-gray-900">团费流水管理</h1>
        <p className="mt-1 text-sm text-gray-500">维护收入与支出流水，支持作废与冲正，汇总净额一目了然。</p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <PageSection padded>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
            <BanknoteArrowUp className="h-4 w-4 text-green-600" />
            总收入
          </div>
          <div className="text-2xl font-semibold text-green-700">{formatCurrency(data.summary.incomeCents)}</div>
        </PageSection>
        <PageSection padded>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
            <BanknoteArrowDown className="h-4 w-4 text-amber-600" />
            总支出
          </div>
          <div className="text-2xl font-semibold text-amber-700">{formatCurrency(data.summary.expenseCents)}</div>
        </PageSection>
        <PageSection padded>
          <div className="mb-2 text-xs font-medium text-gray-500">净额</div>
          <div className={`text-2xl font-semibold ${data.summary.netCents >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            {data.summary.netCents >= 0 ? '+' : '-'}
            {formatCurrency(Math.abs(data.summary.netCents))}
          </div>
          <div className="mt-2 text-xs text-gray-500">条目数：{data.summary.entryCount}</div>
        </PageSection>
      </div>

      <PageSection padded>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">团费趋势</h2>
            <p className="mt-1 text-xs text-gray-500">按天归桶展示收入、支出与净额变化（单位：元）</p>
          </div>
          <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
            当前筛选净额：<span className="font-semibold">{formatCurrency(data.summary.netCents)}</span>
          </div>
        </div>

        {loading && trendData.length === 0 ? (
          <PageState tone="loading" title="正在加载团费趋势..." description="正在同步当前筛选区间的流水聚合结果。" className="px-0 py-10" />
        ) : trendData.length === 0 ? (
          <PageState tone="empty" title="暂无可绘制趋势数据" description="新增团费流水后，这里会展示每日趋势变化。" className="px-0 py-10" />
        ) : (
          <div className="overflow-x-auto" data-testid="admin-ledger-trend-chart">
            <LineChart
              width={Math.max(trendData.length * 110, 720)}
              height={300}
              data={trendData}
              margin={{ top: 12, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} strokeDasharray="4 4" />
              <XAxis dataKey="axisBucketLabel" axisLine={false} tickLine={false} tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={64}
                tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
                tickFormatter={(value) => formatCentsAsYuan(Number(value), 0)}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                formatter={(value) => formatCentsAsYuan(Number(value), 2)}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.bucketKey ?? ''}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                name="收入"
                dataKey="incomeCents"
                stroke={CHART_COLORS.income}
                strokeWidth={2.5}
                dot={{ r: 3.5 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                name="支出"
                dataKey="expenseCents"
                stroke={CHART_COLORS.expense}
                strokeWidth={2.5}
                dot={{ r: 3.5 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                name="净额"
                dataKey="netCents"
                stroke={CHART_COLORS.net}
                strokeWidth={2.5}
                dot={{ r: 3.5 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </div>
        )}
      </PageSection>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <PageSection padded>
          <div className="mb-4 text-sm font-semibold text-gray-900">新增流水</div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">发生时间</span>
              <input
                type="datetime-local"
                aria-label="发生时间"
                value={form.occurredAt}
                onChange={(event) => patchForm({ occurredAt: event.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">类型</span>
              <select
                aria-label="流水类型"
                value={form.type}
                onChange={(event) => patchForm({ type: event.target.value as TeamLedgerType })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="income">income</option>
                <option value="expense">expense</option>
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              id="ledger-amount"
              label="金额（元）"
              value={form.amountYuan}
              onChange={(event) => patchForm({ amountYuan: event.target.value })}
              placeholder="100.00"
            />
            <Input
              id="ledger-category"
              label="分类"
              value={form.category}
              onChange={(event) => patchForm({ category: event.target.value })}
              placeholder="例：dues"
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              id="ledger-counterparty"
              label="对方（可选）"
              value={form.counterparty}
              onChange={(event) => patchForm({ counterparty: event.target.value })}
              placeholder="例：成员张三"
            />
            <Input
              id="ledger-note"
              label="备注（可选）"
              value={form.note}
              onChange={(event) => patchForm({ note: event.target.value })}
              placeholder="补充说明"
            />
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={() => void submitForm()} loading={savingEntryId === 'new'}>
              新增流水
            </Button>
          </div>
        </PageSection>

        <PageSection padded>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">筛选</h2>
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
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'voided')}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="active">active</option>
              <option value="voided">voided</option>
              <option value="all">all</option>
            </select>
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-gray-700">类型</span>
            <select
              aria-label="类型筛选"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as 'all' | TeamLedgerType)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">all</option>
              <option value="income">income</option>
              <option value="expense">expense</option>
            </select>
          </label>

          <div className="mt-4">
            <Input
              id="ledger-category-filter"
              label="分类关键字"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              placeholder="例：dues"
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
            data={data.entries.map((entry) => ({ ...entry, _actions: null }))}
            loading={loading}
            emptyText="当前筛选条件下暂无流水"
            rowKey={(entry) => entry.id}
          />
        )}
      </PageSection>
    </div>
  );
};
