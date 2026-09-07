import { useEffect, useState } from 'react';
import { CalendarClock, RefreshCw } from 'lucide-react';
import { fetchTeamEvents } from '@/lib/api';
import type { TeamEventItem } from '@/types';

const formatEventTime = (value: string) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export const TeamEventsPage = ({ onNotice }: { onNotice: (notice: string) => void }) => {
  const [events, setEvents] = useState<TeamEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { setEvents((await fetchTeamEvents()).items); }
    catch (error) { onNotice(error instanceof Error ? error.message : '团队事务加载失败。'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  return <div className="page team-events-page"><section className="welcome-row"><div><p className="eyebrow">TEAM EVENTS</p><h1>团队<span>事务</span></h1><p>查看团队公开的安排与进度；创建和修改仅向管理员开放。</p></div><button className="admin-reload" onClick={() => void load()} disabled={loading}><RefreshCw size={14} />刷新</button></section><section className="team-events-list">{loading ? <p className="admin-empty">正在读取团队事务…</p> : events.length ? events.map((event) => <article className="blue-card team-event-card" key={event.id}><div className={`team-event-date ${event.status}`}><CalendarClock size={19} /><time>{formatEventTime(event.eventAt)}</time></div><div><span className={`event-status ${event.status}`}>{event.status === 'planned' ? '计划中' : event.status === 'done' ? '已完成' : '已取消'}</span><h2>{event.title}</h2><p>{event.description || '暂无详细说明。'}</p></div></article>) : <section className="blue-card empty-panel"><CalendarClock size={29} /><h2>暂无团队事务</h2><p>管理员发布的团队安排会显示在这里。</p></section>}</section></div>;
};
