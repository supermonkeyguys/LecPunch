import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Download, Shield, UserCheck, Users, WalletCards, Wifi } from 'lucide-react';
import { Badge, Button } from '@lecpunch/ui';
import { useAuthStore } from '@/app/store/auth-store';
import { getAdminNetworkPolicy, type AdminNetworkPolicy } from '@/features/network-policy/network-policy.api';
import { getAdminMembers } from '@/features/users/users.api';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { getApiErrorMessage } from '@/shared/lib/api-error';
import { PageSection } from '@/shared/ui/PageSection';
import { PageState } from '@/shared/ui/PageState';

interface AdminDashboardData {
  memberCount: number;
  activeMemberCount: number;
  networkPolicy: AdminNetworkPolicy | null;
}

const adminTools = [
  { title: '成员与管理员', description: '迁移、停用成员账号，并分配管理员角色。', to: '/admin/members', icon: Users },
  { title: '网络打卡网关', description: '设置允许打卡的公网出口 IP、LAN/VPN 网段与代理链路。', to: '/admin/network-policy', icon: Wifi },
  { title: '准入名单', description: '维护可进入团队的学号名单和入组状态。', to: '/admin/member-eligibility', icon: UserCheck },
  { title: '团队日程', description: '创建团队活动与定时提醒。', to: '/admin/events', icon: CalendarClock },
  { title: '团费流水', description: '登记、冲销并查看团队资金明细。', to: '/admin/ledger', icon: WalletCards },
  { title: '记录导出', description: '按需导出考勤记录，便于归档与汇总。', to: '/admin/records-export', icon: Download }
];

export const AdminDashboardPage = () => {
  const user = useAuthStore((state) => state.auth.user);
  const fetchDashboard = useCallback(async (_signal: AbortSignal): Promise<AdminDashboardData> => {
    const [members, networkPolicy] = await Promise.all([getAdminMembers(), getAdminNetworkPolicy()]);
    return {
      memberCount: members.length,
      activeMemberCount: members.filter((member) => member.status === 'active').length,
      networkPolicy
    };
  }, []);
  const { data, loading, error, refresh } = useAsyncData(fetchDashboard, [], {
    initialData: { memberCount: 0, activeMemberCount: 0, networkPolicy: null }
  });

  if (loading) {
    return <PageState tone="loading" title="正在加载管理控制台" description="正在读取成员和网络网关状态。" />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-8">
        <PageSection padded>
          <PageState
            tone="error"
            title={getApiErrorMessage(error, '加载管理控制台失败')}
            description="请确认当前账号仍具备管理员权限后重试。"
            action={<Button variant="outline" onClick={refresh}>重新加载</Button>}
          />
        </PageSection>
      </div>
    );
  }

  const networkLocked = data.networkPolicy ? !data.networkPolicy.allowAnyNetwork : false;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-blue-700"><Shield className="h-4 w-4" />管理员控制台</div>
          <h1 className="text-2xl font-bold text-gray-900">团队管理主页</h1>
          <p className="mt-1 text-sm text-gray-500">管理员 {user?.displayName ?? user?.username ?? '—'}，在这里统一维护账号、打卡网关与团队数据。</p>
        </div>
        <Link to="/admin/network-policy"><Button variant="outline"><Wifi className="h-4 w-4" />配置打卡网关</Button></Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <PageSection padded><p className="text-sm text-gray-500">成员总数</p><p className="mt-2 text-3xl font-bold text-gray-900">{data.memberCount}</p></PageSection>
        <PageSection padded><p className="text-sm text-gray-500">已启用成员</p><p className="mt-2 text-3xl font-bold text-gray-900">{data.activeMemberCount}</p></PageSection>
        <PageSection padded>
          <div className="flex items-center justify-between"><p className="text-sm text-gray-500">打卡网关</p><Badge variant={networkLocked ? 'success' : 'warning'}>{networkLocked ? '白名单已启用' : '任意网络'}</Badge></div>
          <p className="mt-2 text-sm text-gray-700">{networkLocked ? `已配置 ${data.networkPolicy?.allowedPublicIps.length ?? 0} 个 IP、${data.networkPolicy?.allowedCidrs.length ?? 0} 个网段。` : '当前允许任意网络打卡，生产环境应关闭。'}</p>
        </PageSection>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {adminTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.to} to={tool.to} className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <PageSection padded className="h-full transition group-hover:border-blue-300 group-hover:shadow-md">
                <div className="flex items-start gap-4"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-gray-900">{tool.title}</h2><ArrowRight className="h-4 w-4 text-gray-400 transition group-hover:translate-x-1 group-hover:text-blue-600" /></div><p className="mt-2 text-sm leading-6 text-gray-500">{tool.description}</p></div></div>
              </PageSection>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
