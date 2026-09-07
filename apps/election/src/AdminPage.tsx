import { useEffect, useMemo, useState } from 'react';
import { BellRing, Check, Clock3, FileWarning, Image, LoaderCircle, ShieldCheck, UserCog, UsersRound, Wifi, X } from 'lucide-react';
import {
  ApiError,
  fetchAdminReports,
  fetchAdminMembers,
  fetchAdminNetworkPolicy,
  fetchNetworkPolicyStatus,
  fetchReportImage,
  deleteAdminMember,
  updateAdminMember,
  updateAdminNetworkPolicy
} from '@/lib/api';
import type { AdminNetworkPolicy, ElectionNotification, ElectionUser, ReportItem } from '@/types';
import { AdminOperationsPanel } from '@/AdminOperationsPanel';

const toLines = (items: string[]) => items.join('\n');
const fromLines = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

export const AdminPage = ({
  onNotice,
  currentUserId,
  notifications,
  onAcknowledgeNotification
}: {
  onNotice: (message: string) => void;
  currentUserId: string;
  notifications: ElectionNotification[];
  onAcknowledgeNotification: (notificationId: string) => Promise<void>;
}) => {
  const [members, setMembers] = useState<ElectionUser[]>([]);
  const [policy, setPolicy] = useState<AdminNetworkPolicy | null>(null);
  const [allowedPublicIps, setAllowedPublicIps] = useState('');
  const [allowedCidrs, setAllowedCidrs] = useState('');
  const [allowAnyNetwork, setAllowAnyNetwork] = useState(false);
  const [trustProxy, setTrustProxy] = useState(true);
  const [trustedProxyHops, setTrustedProxyHops] = useState('1');
  const [networkStatus, setNetworkStatus] = useState<{ clientIp: string; isAllowed: boolean } | null>(null);
  const [networkDebugStatus, setNetworkDebugStatus] = useState<{ clientIp: string; isAllowed: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [memberAction, setMemberAction] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [memberPendingDelete, setMemberPendingDelete] = useState<ElectionUser | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [nextMembers, nextPolicy, nextNetworkStatus, nextNetworkDebugStatus] = await Promise.all([fetchAdminMembers(), fetchAdminNetworkPolicy(), fetchNetworkPolicyStatus(), fetchNetworkPolicyStatus(true)]);
      setMembers(nextMembers);
      setPolicy(nextPolicy);
      setAllowedPublicIps(toLines(nextPolicy.allowedPublicIps));
      setAllowedCidrs(toLines(nextPolicy.allowedCidrs));
      setAllowAnyNetwork(nextPolicy.allowAnyNetwork);
      setTrustProxy(nextPolicy.trustProxy);
      setTrustedProxyHops(String(nextPolicy.trustedProxyHops));
      setNetworkStatus(nextNetworkStatus);
      setNetworkDebugStatus(nextNetworkDebugStatus);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '管理员数据加载失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const result = await fetchAdminReports(reportsPage, 20);
      setReports(result.items);
      setReportsTotal(result.total);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '请假申请列表加载失败。');
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => { void loadReports(); }, [reportsPage]);

  const activeMembers = useMemo(() => members.filter((member) => member.status !== 'disabled').length, [members]);

  const changeMember = async (member: ElectionUser, input: Partial<Pick<ElectionUser, 'role' | 'status'>>) => {
    setMemberAction(member.id);
    try {
      const updated = await updateAdminMember(member.id, input);
      setMembers((current) => current.map((item) => item.id === updated.id ? updated : item));
      onNotice(`已更新 ${updated.displayName}。`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '成员更新失败。');
    } finally {
      setMemberAction(null);
    }
  };

  const saveNetworkPolicy = async () => {
    if (!allowAnyNetwork && !allowedPublicIps.trim() && !allowedCidrs.trim()) {
      onNotice('至少填写一个团队公网出口 IP 或 CIDR 网段。');
      return;
    }
    setSavingPolicy(true);
    try {
      const updated = await updateAdminNetworkPolicy({
        allowAnyNetwork,
        allowedPublicIps: fromLines(allowedPublicIps),
        allowedCidrs: fromLines(allowedCidrs),
        trustProxy,
        trustedProxyHops: Math.max(1, Number(trustedProxyHops) || 1)
      });
      setPolicy(updated);
      setAllowedPublicIps(toLines(updated.allowedPublicIps));
      setAllowedCidrs(toLines(updated.allowedCidrs));
      setAllowAnyNetwork(updated.allowAnyNetwork);
      setTrustProxy(updated.trustProxy);
      setTrustedProxyHops(String(updated.trustedProxyHops));
      onNotice('团队网络白名单已保存，打卡将立即按新规则校验。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '网络策略保存失败。');
    } finally {
      setSavingPolicy(false);
    }
  };

  const confirmMemberDelete = async () => {
    const member = memberPendingDelete;
    if (!member) return;
    setMemberAction(member.id);
    try {
      await deleteAdminMember(member.id);
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setMemberPendingDelete(null);
      onNotice(`已删除 ${member.displayName}。`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '成员删除失败。');
    } finally { setMemberAction(null); }
  };

  if (loading) return <div className="page admin-page"><section className="blue-card admin-loading"><LoaderCircle size={24} />正在读取管理员数据…</section></div>;

  return <div className="page admin-page">
    <section className="welcome-row"><div><p className="eyebrow">ADMIN CONSOLE</p><h1>管理员<span>控制台</span></h1><p>管理员可在任意网络登录并维护数据；只有成员的打卡请求需要命中团队网络白名单。</p></div><button className="admin-reload" onClick={() => void load()}>刷新数据</button></section>

    <section className="admin-summary-grid">
      <article className="blue-card admin-summary"><UsersRound size={20} /><div><small>团队账户</small><strong>{members.length}</strong><span>{activeMembers} 个已启用</span></div></article>
      <article className="blue-card admin-summary"><Wifi size={20} /><div><small>打卡网关</small><strong>{policy?.allowAnyNetwork ? '未限制' : '白名单'}</strong><span>{policy ? `${policy.allowedPublicIps.length} 个 IP · ${policy.allowedCidrs.length} 个网段` : '未读取'}</span></div></article>
      <article className="blue-card admin-summary"><ShieldCheck size={20} /><div><small>管理权限</small><strong>已验证</strong><span>管理操作不受打卡地点限制</span></div></article>
    </section>

    <section className="admin-grid">
      <article className="blue-card admin-card network-card"><header><div><Wifi size={19} /><div><h2>团队打卡网络</h2><p>仅控制上卡、下卡；管理员管理数据不受地点限制。</p></div></div></header><div className="network-lock"><Check size={15} />成员状态：{networkStatus?.clientIp || '未读取'} · {networkStatus?.isAllowed ? '符合策略' : '不符合策略'}<br />管理员调试：{networkDebugStatus?.clientIp || '未读取'} · {networkDebugStatus?.isAllowed ? '符合策略' : '不符合策略'}</div><label className="inline-check"><input type="checkbox" checked={allowAnyNetwork} onChange={(event) => setAllowAnyNetwork(event.target.checked)} />允许任意网络打卡（关闭后按白名单校验）</label><label>允许的公网出口 IP<textarea value={allowedPublicIps} onChange={(event) => setAllowedPublicIps(event.target.value)} placeholder="每行一个 IP，例如 203.0.113.10" rows={5} /></label><label>允许的内网 / VPN CIDR<textarea value={allowedCidrs} onChange={(event) => setAllowedCidrs(event.target.value)} placeholder="每行一个网段，例如 10.0.0.0/8" rows={4} /></label><div className="network-proxy-fields"><label className="inline-check"><input type="checkbox" checked={trustProxy} onChange={(event) => setTrustProxy(event.target.checked)} />信任受控反向代理</label><label>可信代理层数<input type="number" min="1" value={trustedProxyHops} onChange={(event) => setTrustedProxyHops(event.target.value)} /></label></div><p className="admin-hint">五项策略字段会原样提交：任意网络、IP、CIDR、代理信任与代理层数。公网服务器识别的是出口 IP，不是 Wi‑Fi 名称。</p><button className="profile-save" disabled={savingPolicy} onClick={() => void saveNetworkPolicy()}>{savingPolicy ? '保存中…' : '保存团队网络策略'}<Wifi size={16} /></button></article>

      <article className="blue-card admin-card member-admin-card"><header><div><UserCog size={19} /><div><h2>成员与角色</h2><p>启用、停用账户、角色调整与删除；本人不会显示删除入口。</p></div></div></header><div className="admin-member-list">{members.map((member) => <div className="admin-member-row" key={member.id}><div className="admin-member-avatar">{member.avatarBase64 ? <img src={member.avatarBase64} alt="" /> : member.avatarEmoji || member.displayName.slice(0, 1)}</div><div className="admin-member-info"><strong>{member.displayName}{member.realName ? <small>（{member.realName}）</small> : null}</strong><span>@{member.username} · {member.enrollYear ? `${member.enrollYear}级` : '未设置年级'}</span></div><span className={`admin-role ${member.role}`}>{member.role === 'admin' ? '管理员' : '成员'}</span><div className="admin-row-actions">{member.id === currentUserId ? <small className="self-action-note">本人</small> : <><button disabled={memberAction === member.id} onClick={() => void changeMember(member, { role: member.role === 'admin' ? 'member' : 'admin' })}>{member.role === 'admin' ? '降为成员' : '设为管理员'}</button><button className={member.status === 'disabled' ? 'is-enable' : 'is-disable'} disabled={memberAction === member.id} onClick={() => void changeMember(member, { status: member.status === 'disabled' ? 'active' : 'disabled' })}>{member.status === 'disabled' ? '启用' : '停用'}</button><button className="is-disable" disabled={memberAction === member.id} onClick={() => setMemberPendingDelete(member)}>删除</button></>}</div></div>)}</div></article>
    </section>
    <AdminReportsPanel reports={reports} page={reportsPage} total={reportsTotal} loading={reportsLoading} notifications={notifications} onPageChange={setReportsPage} onRefresh={() => void loadReports()} onNotice={onNotice} onAcknowledgeNotification={onAcknowledgeNotification} />
    <AdminOperationsPanel onNotice={onNotice} />
    {memberPendingDelete ? <div className="member-delete-mask" role="dialog" aria-modal="true" aria-label="确认删除成员"><section className="blue-card member-delete-dialog"><p className="eyebrow">IRREVERSIBLE ACTION</p><h2>删除 {memberPendingDelete.displayName}？</h2><p>将删除该成员账户及服务端关联数据。此操作不可恢复，且不会影响当前管理员本人。</p><div><button onClick={() => setMemberPendingDelete(null)}>取消</button><button className="soft-danger" disabled={memberAction === memberPendingDelete.id} onClick={() => void confirmMemberDelete()}>确认永久删除</button></div></section></div> : null}
  </div>;
};

const AdminReportsPanel = ({
  reports,
  page,
  total,
  loading,
  notifications,
  onPageChange,
  onRefresh,
  onNotice,
  onAcknowledgeNotification
}: {
  reports: ReportItem[];
  page: number;
  total: number;
  loading: boolean;
  notifications: ElectionNotification[];
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onNotice: (message: string) => void;
  onAcknowledgeNotification: (notificationId: string) => Promise<void>;
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLabel, setImageLabel] = useState('');
  const [loadingImage, setLoadingImage] = useState<string | null>(null);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const showImage = async (reportId: string, imageId: string) => {
    setLoadingImage(`${reportId}:${imageId}`);
    try {
      const blob = await fetchReportImage(reportId, imageId);
      const nextUrl = URL.createObjectURL(blob);
      setImageUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setImageLabel('请假附件（仅本地临时预览）');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) onNotice('图片已过期，服务器已自动清理。');
      else onNotice(error instanceof Error ? error.message : '图片读取失败。');
    } finally {
      setLoadingImage(null);
    }
  };

  const unackedReports = notifications.filter((item) => item.type === 'report.submitted' && !item.acknowledgedAt);
  const pages = Math.max(1, Math.ceil(total / 20));
  return <section className="admin-reports-layout">
    <article className="blue-card admin-card admin-notifications-card"><header><div><BellRing size={19} /><div><h2>请假提醒</h2><p>来自受鉴权 SSE 的未确认通知；重新连接后会自动补拉。</p></div></div></header>{unackedReports.length ? <div className="admin-notification-list">{unackedReports.map((item) => <div className="admin-notification-row" key={item.id}><div><strong>收到新的请假申请</strong><span>{typeof item.payload.reporterDisplayName === 'string' ? `${item.payload.reporterDisplayName} 提交了一条请假申请，请及时查看。` : '有成员提交了一条请假申请，请及时查看。'}</span><small>{new Date(item.createdAt).toLocaleString('zh-CN')}</small></div><button onClick={() => void onAcknowledgeNotification(item.id)}>确认</button></div>)}</div> : <p className="admin-empty">暂无未确认的请假提醒。</p>}</article>
    <article className="blue-card admin-card admin-reports-card"><header><div><FileWarning size={19} /><div><h2>团队请假申请</h2><p>附件仅通过带 Authorization 的请求读取，不会生成公开链接或缓存。</p></div></div><button className="admin-reload" onClick={onRefresh}>刷新</button></header>{loading ? <p className="admin-empty">正在读取请假申请…</p> : reports.length ? <div className="admin-report-list">{reports.map((report) => <article className="admin-report-row" key={report.id}><div className="admin-report-main"><div><strong>{report.reporter.displayName}</strong><span>@{report.reporter.username} · {new Date(report.createdAt).toLocaleString('zh-CN')}</span></div><p>{report.description}</p><small>{report.imagesExpireAt ? <><Clock3 size={12} /> 图片将在 {new Date(report.imagesExpireAt).toLocaleString('zh-CN')} 过期</> : '无图片附件'}</small></div><div className="admin-report-images">{report.images.map((image) => <button key={image.id} disabled={loadingImage === `${report.id}:${image.id}`} onClick={() => void showImage(report.id, image.id)}><Image size={14} />{loadingImage === `${report.id}:${image.id}` ? '读取中…' : `${Math.ceil(image.sizeBytes / 1024)}KB`}</button>)}</div></article>)}</div> : <p className="admin-empty">当前团队还没有请假申请。</p>}{pages > 1 ? <div className="admin-pagination"><button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>上一页</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => onPageChange(page + 1)}>下一页</button></div> : null}</article>
    {imageUrl ? <div className="report-image-modal" role="dialog" aria-modal="true" aria-label={imageLabel}><button onClick={() => setImageUrl((current) => { if (current) URL.revokeObjectURL(current); return null; })} aria-label="关闭图片预览"><X size={19} /></button><img src={imageUrl} alt={imageLabel} /><span>{imageLabel}</span></div> : null}
  </section>;
};
