import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Shield, UserCheck } from 'lucide-react';
import { Badge, Button, DataTable, Input, type ColumnDef } from '@lecpunch/ui';
import type { MemberEligibilityEntry } from '@lecpunch/shared';
import {
  createAdminMemberEligibilityEntry,
  deleteAdminMemberEligibilityEntry,
  getAdminMemberEligibilityEntries,
  updateAdminMemberEligibilityEntry
} from '@/features/member-eligibility/member-eligibility.api';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { formatDateTime } from '@/shared/lib/time';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';
import { showToast } from '@/shared/ui/toast';

interface AdminMemberEligibilityRow extends MemberEligibilityEntry {
  _actions: null;
}

type EligibilityFormValues = {
  studentId: string;
  realName: string;
  status: 'allowed' | 'blocked';
  note: string;
};

const emptyForm: EligibilityFormValues = {
  studentId: '',
  realName: '',
  status: 'allowed',
  note: ''
};

export const AdminMemberEligibilityPage = () => {
  const [entries, setEntries] = useState<MemberEligibilityEntry[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'allowed' | 'blocked'>('all');
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<MemberEligibilityEntry | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchEntries = useCallback(async (_signal: AbortSignal) => {
    return getAdminMemberEligibilityEntries({ limit: 500 });
  }, []);
  const { data: loadedEntries, loading, error, refresh } = useAsyncData(fetchEntries, [], {
    initialData: [] as MemberEligibilityEntry[]
  });

  useEffect(() => {
    setEntries(loadedEntries);
  }, [loadedEntries]);

  const loadError = error ? getApiErrorMessage(error, '加载准入名单失败') : null;

  const filteredEntries = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const statusMatched = statusFilter === 'all' || entry.status === statusFilter;
      if (!statusMatched) {
        return false;
      }
      if (!keyword) {
        return true;
      }

      return [entry.studentId, entry.realName, entry.note]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(keyword));
    });
  }, [entries, search, statusFilter]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingEntry(null);
  };

  const patchForm = (next: Partial<EligibilityFormValues>) => {
    setForm((current) => ({ ...current, ...next }));
  };

  const startEditing = (entry: MemberEligibilityEntry) => {
    setEditingEntry(entry);
    setForm({
      studentId: entry.studentId,
      realName: entry.realName,
      status: entry.status,
      note: entry.note ?? ''
    });
  };

  const submitForm = async () => {
    const studentId = form.studentId.trim();
    const realName = form.realName.trim();
    if (!studentId || !realName) {
      showToast('学号和真实姓名不能为空', 'error');
      return;
    }

    if (!/^\d{12}$/.test(studentId)) {
      showToast('学号必须是 12 位数字', 'error');
      return;
    }

    setSavingEntryId(editingEntry?.id ?? 'new');
    try {
      if (editingEntry) {
        const updated = await updateAdminMemberEligibilityEntry(editingEntry.id, {
          studentId,
          realName,
          status: form.status,
          note: form.note.trim() || undefined
        });
        setEntries((current) => current.map((item) => (item.id === editingEntry.id ? updated : item)));
        showToast('准入条目已更新');
      } else {
        const created = await createAdminMemberEligibilityEntry({
          studentId,
          realName,
          status: form.status,
          note: form.note.trim() || undefined
        });
        setEntries((current) => [created, ...current]);
        showToast('准入条目已创建');
      }
      resetForm();
    } catch (error) {
      showToast(getApiErrorMessage(error, editingEntry ? '更新准入条目失败' : '创建准入条目失败'), 'error');
    } finally {
      setSavingEntryId(null);
    }
  };

  const toggleStatus = async (entry: MemberEligibilityEntry) => {
    const nextStatus = entry.status === 'allowed' ? 'blocked' : 'allowed';
    const ok = window.confirm(
      nextStatus === 'blocked'
        ? `确认将 ${entry.studentId} 设为 blocked 吗？`
        : `确认将 ${entry.studentId} 恢复为 allowed 吗？`
    );
    if (!ok) {
      return;
    }

    setSavingEntryId(entry.id);
    try {
      const updated = await updateAdminMemberEligibilityEntry(entry.id, { status: nextStatus });
      setEntries((current) => current.map((item) => (item.id === entry.id ? updated : item)));
      showToast(nextStatus === 'blocked' ? '已设置为 blocked' : '已恢复为 allowed');
    } catch (error) {
      showToast(getApiErrorMessage(error, '更新状态失败'), 'error');
    } finally {
      setSavingEntryId(null);
    }
  };

  const removeEntry = async (entry: MemberEligibilityEntry) => {
    const ok = window.confirm(`确认删除学号 ${entry.studentId} 的准入条目吗？`);
    if (!ok) {
      return;
    }

    setSavingEntryId(entry.id);
    try {
      await deleteAdminMemberEligibilityEntry(entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      if (editingEntry?.id === entry.id) {
        resetForm();
      }
      showToast('准入条目已删除');
    } catch (error) {
      showToast(getApiErrorMessage(error, '删除准入条目失败'), 'error');
    } finally {
      setSavingEntryId(null);
    }
  };

  const columns: ColumnDef<AdminMemberEligibilityRow>[] = [
    {
      key: 'studentId',
      header: '学号',
      render: (value) => <span className="font-mono text-sm text-gray-800">{value}</span>
    },
    {
      key: 'realName',
      header: '真实姓名',
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'status',
      header: '状态',
      render: (value) =>
        value === 'allowed' ? <Badge variant="success">allowed</Badge> : <Badge variant="warning">blocked</Badge>
    },
    {
      key: 'note',
      header: '备注',
      render: (value) => (value ? <span className="text-sm text-gray-600">{value}</span> : <span className="text-sm text-gray-400">-</span>)
    },
    {
      key: 'updatedAt',
      header: '更新时间',
      render: (value) => (value ? <span className="text-sm text-gray-600">{formatDateTime(String(value))}</span> : <span className="text-sm text-gray-400">-</span>)
    },
    {
      key: '_actions',
      header: '操作',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (_, row) => {
        const isSaving = savingEntryId === row.id;
        return (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={isSaving} onClick={() => startEditing(row)}>
              编辑
            </Button>
            <Button variant="outline" size="sm" disabled={isSaving} onClick={() => void toggleStatus(row)}>
              {row.status === 'allowed' ? '设为 blocked' : '恢复 allowed'}
            </Button>
            <Button variant="danger" size="sm" disabled={isSaving} onClick={() => void removeEntry(row)}>
              删除
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-blue-700">
            <Shield className="h-4 w-4" />
            管理后台
          </div>
          <h1 className="text-2xl font-bold text-gray-900">准入名单管理</h1>
          <p className="mt-1 text-sm text-gray-500">维护可注册成员白名单（学号 + 真实姓名），支持状态切换与条目删除。</p>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <PageSection padded>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <UserCheck className="h-4 w-4 text-blue-600" />
            {editingEntry ? '编辑准入条目' : '新增准入条目'}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              id="eligibility-student-id"
              label="学号"
              value={form.studentId}
              onChange={(event) => patchForm({ studentId: event.target.value })}
              placeholder="202400000001"
            />
            <Input
              id="eligibility-real-name"
              label="真实姓名"
              value={form.realName}
              onChange={(event) => patchForm({ realName: event.target.value })}
              placeholder="张三"
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">状态</span>
              <select
                aria-label="准入状态"
                value={form.status}
                onChange={(event) => patchForm({ status: event.target.value as 'allowed' | 'blocked' })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="allowed">allowed</option>
                <option value="blocked">blocked</option>
              </select>
            </label>

            <Input
              id="eligibility-note"
              label="备注（可选）"
              value={form.note}
              onChange={(event) => patchForm({ note: event.target.value })}
              placeholder="例：已核验实名"
            />
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <Button variant="outline" onClick={resetForm} disabled={Boolean(savingEntryId)}>
              取消
            </Button>
            <Button onClick={() => void submitForm()} loading={Boolean(savingEntryId && (editingEntry ? savingEntryId === editingEntry.id : savingEntryId === 'new'))}>
              {editingEntry ? '保存修改' : '新增条目'}
            </Button>
          </div>
        </PageSection>

        <PageSection padded>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">筛选与搜索</h2>
            <Button variant="outline" size="sm" onClick={refresh}>
              重新加载
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="按学号、姓名、备注搜索"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-gray-700">状态筛选</span>
            <select
              aria-label="状态筛选"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'allowed' | 'blocked')}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">全部</option>
              <option value="allowed">allowed</option>
              <option value="blocked">blocked</option>
            </select>
          </label>
        </PageSection>
      </div>

      <PageSection>
        {loadError ? (
          <PageState
            tone="error"
            title={loadError}
            description="请确认当前账号具备管理员权限，然后重新加载准入名单。"
            action={
              <Button variant="outline" size="sm" onClick={refresh}>
                重新加载
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredEntries.map((entry) => ({ ...entry, _actions: null }))}
            loading={loading}
            emptyText="暂无准入条目"
            rowKey={(entry) => entry.id}
          />
        )}
      </PageSection>
    </div>
  );
};
