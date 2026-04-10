import { useEffect, useMemo, useState } from 'react';
import { Shield, Search } from 'lucide-react';
import { Badge, Button, DataTable, type ColumnDef } from '@lecpunch/ui';
import type { User } from '@lecpunch/shared';
import { getAdminMembers, updateAdminMember } from '@/features/users/users.api';
import { useRootStore } from '@/app/store/root-store';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';
import { showToast } from '@/shared/ui/toast';

interface AdminMembersRow extends User {
  _actions: null;
}

export const AdminMembersPage = () => {
  const currentUser = useRootStore((state) => state.auth.user);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextMembers = await getAdminMembers();
        if (!cancelled) {
          setMembers(nextMembers);
        }
      } catch (error) {
        if (!cancelled) {
          setError(getApiErrorMessage(error, '加载成员列表失败'));
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
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return members;
    }

    return members.filter((member) =>
      [member.displayName, member.username, member.realName, member.studentId]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(normalizedSearch))
    );
  }, [members, search]);

  const applyMemberPatch = async (member: User, patch: { role?: User['role']; status?: User['status'] }) => {
    setSavingUserId(member.id);

    try {
      const updated = await updateAdminMember(member.id, patch);
      setMembers((current) => current.map((item) => (item.id === member.id ? updated : item)));
      showToast('成员信息已更新');
    } catch (error) {
      showToast(getApiErrorMessage(error, '更新成员失败'), 'error');
    } finally {
      setSavingUserId(null);
    }
  };

  const columns: ColumnDef<AdminMembersRow>[] = [
    {
      key: 'displayName',
      header: '成员',
      render: (_, row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{row.displayName}</span>
            {row.id === currentUser?.id ? <Badge variant="info">本人</Badge> : null}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            @{row.username}
            {row.realName ? ` · ${row.realName}` : ''}
            {row.studentId ? ` · ${row.studentId}` : ''}
          </div>
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
      key: 'status',
      header: '状态',
      render: (value) =>
        value === 'active' ? <Badge variant="success">启用中</Badge> : <Badge variant="warning">已停用</Badge>
    },
    {
      key: 'enrollYear',
      header: '年级',
      render: (value) => <span className="font-mono text-sm text-gray-700">{value}</span>
    },
    {
      key: '_actions',
      header: '操作',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (_, row) => {
        const isSelf = row.id === currentUser?.id;
        const isSaving = savingUserId === row.id;

        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isSelf || isSaving}
              onClick={() =>
                void applyMemberPatch(row, {
                  role: row.role === 'admin' ? 'member' : 'admin'
                })
              }
            >
              {row.role === 'admin' ? '降为成员' : '设为管理员'}
            </Button>
            <Button
              variant={row.status === 'active' ? 'danger' : 'outline'}
              size="sm"
              disabled={isSelf || isSaving}
              onClick={() =>
                void applyMemberPatch(row, {
                  status: row.status === 'active' ? 'disabled' : 'active'
                })
              }
            >
              {row.status === 'active' ? '停用' : '启用'}
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
          <h1 className="text-2xl font-bold text-gray-900">成员管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理团队成员的角色和启用状态，普通成员无权访问此页面。</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索成员、用户名或学号..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <PageSection>
        {error ? (
          <PageState
            tone="error"
            title={error}
            description="请确认当前账号具备管理员权限，然后重新加载成员列表。"
            action={
              <Button variant="outline" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
                重新加载
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredMembers.map((member) => ({ ...member, _actions: null }))}
            loading={loading}
            emptyText="暂无可管理成员"
            rowKey={(member) => member.id}
          />
        )}
      </PageSection>
    </div>
  );
};
