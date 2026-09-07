import { useEffect, useState } from 'react';
import { BarChart3, LoaderCircle, Trash2, X } from 'lucide-react';
import { deleteAdminRecord, fetchMemberRecords, fetchMemberWeeklyStats, markAdminRecord } from '@/lib/api';
import type { MemberWeeklyStatsResponse, MyRecordsResponse, TeamWeeklyStat } from '@/types';

const timeText = (value: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '尚未下卡';
const durationText = (seconds: number) => `${Math.floor(seconds / 3600)}小时${Math.floor(seconds % 3600 / 60)}分`;

export const MemberAttendanceDialog = ({ member, isAdmin, onClose, onNotice }: { member: TeamWeeklyStat; isAdmin: boolean; onClose: () => void; onNotice: (message: string) => void }) => {
  const [stats, setStats] = useState<MemberWeeklyStatsResponse | null>(null);
  const [records, setRecords] = useState<MyRecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const [nextStats, nextRecords] = await Promise.all([fetchMemberWeeklyStats(member.memberKey), fetchMemberRecords(member.memberKey, { page: 1, pageSize: 20 })]);
      setStats(nextStats); setRecords(nextRecords);
    } catch (error) { onNotice(error instanceof Error ? error.message : '成员记录加载失败。'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [member.memberKey]);
  const toggleMarked = async (recordId: string, marked: boolean) => {
    setActing(recordId);
    try { await markAdminRecord(recordId, !marked); setRecords((current) => current ? { ...current, items: current.items.map((item) => item.id === recordId ? { ...item, isMarked: !marked } : item) } : current); }
    catch (error) { onNotice(error instanceof Error ? error.message : '记录标记失败。'); }
    finally { setActing(null); }
  };
  const removeRecord = async (recordId: string) => {
    if (!window.confirm('删除这条打卡原始记录？该操作不可恢复。')) return;
    setActing(recordId);
    try { await deleteAdminRecord(recordId); setRecords((current) => current ? { ...current, items: current.items.filter((item) => item.id !== recordId) } : current); onNotice('打卡记录已删除。'); }
    catch (error) { onNotice(error instanceof Error ? error.message : '记录删除失败。'); }
    finally { setActing(null); }
  };
  return <div className="member-inspect-mask" role="dialog" aria-modal="true" aria-label={`${member.displayName} 的打卡记录`}><section className="blue-card member-inspect-dialog"><button className="schedule-close" onClick={onClose} aria-label="关闭"><X size={18} /></button><header><div><p className="eyebrow">MEMBER ATTENDANCE</p><h2>{member.displayName} 的打卡记录</h2><p>成员标识仅来自团队统计接口返回的 memberKey。</p></div><BarChart3 size={21} /></header>{loading ? <p className="admin-empty"><LoaderCircle size={15} /> 正在读取…</p> : <><div className="member-week-history">{stats?.items.map((item) => <div key={item.weekKey}><strong>{item.weekKey}</strong><span>{durationText(item.totalDurationSeconds)}</span><small>{item.sessionsCount} 次{item.adjustmentsCount ? ` · 含 ${item.adjustmentsCount} 条调整` : ''}</small></div>)}</div><div className="member-record-list">{records?.items.map((record) => <div key={record.id}><div><strong>{timeText(record.checkInAt)}</strong><span>{durationText(record.durationSeconds)} · {record.status === 'completed' ? '已完成' : record.status === 'active' ? '进行中' : '已失效'}</span></div>{isAdmin ? <aside><button disabled={acting === record.id} onClick={() => void toggleMarked(record.id, record.isMarked)}>{record.isMarked ? '取消标记' : '标记'}</button><button className="soft-danger" disabled={acting === record.id} onClick={() => void removeRecord(record.id)}><Trash2 size={13} />删除</button></aside> : null}</div>) || <p className="admin-empty">暂无记录。</p>}</div></>}</section></div>;
};
