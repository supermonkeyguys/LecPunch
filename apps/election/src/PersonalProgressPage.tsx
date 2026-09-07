import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, History, RefreshCw, ShieldCheck, TimerReset } from 'lucide-react';
import { ApiError, fetchMyRecords, fetchMyWeeklyStats, fetchMyWeeklySummary, fetchPoints } from '@/lib/api';
import { getShanghaiIsoWeek, isoWeekToShanghaiMonday, isIsoWeek } from '@/lib/week';
import type { AttendanceWeeklySummary, MyRecordsResponse, MyWeeklyStatsResponse, PointsSummary } from '@/types';

const formatMinutes = (minutes: number) => {
  const sign = minutes < 0 ? '−' : '';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  return `${sign}${hours ? `${hours}小时` : ''}${absolute % 60}分`;
};

const formatSeconds = (seconds: number) => formatMinutes(Math.floor(seconds / 60));
const formatDateTime = (value: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '尚未下卡';

const shiftIsoWeek = (week: string, direction: -1 | 1) => {
  const monday = new Date(`${isoWeekToShanghaiMonday(week)}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() + direction * 7);
  const thursday = new Date(monday.valueOf());
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const weekday = januaryFourth.getUTCDay() || 7;
  januaryFourth.setUTCDate(januaryFourth.getUTCDate() + 4 - weekday);
  return `${year}-W${String(1 + Math.round((thursday.valueOf() - januaryFourth.valueOf()) / 604_800_000)).padStart(2, '0')}`;
};

export const PersonalProgressPage = ({ onNotice }: { onNotice: (notice: string) => void }) => {
  const [week, setWeek] = useState(getShanghaiIsoWeek);
  const [points, setPoints] = useState<PointsSummary | null>(null);
  const [summary, setSummary] = useState<AttendanceWeeklySummary | null>(null);
  const [records, setRecords] = useState<MyRecordsResponse | null>(null);
  const [stats, setStats] = useState<MyWeeklyStatsResponse | null>(null);
  const [recordsPage, setRecordsPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  const recordsQuery = useMemo(() => {
    const hasDateFilter = Boolean(startDate || endDate);
    return hasDateFilter
      ? { page: recordsPage, pageSize: 12, startDate: startDate || undefined, endDate: endDate || undefined }
      : { page: recordsPage, pageSize: 12, weekKey: isIsoWeek(week) ? isoWeekToShanghaiMonday(week) : undefined };
  }, [endDate, recordsPage, startDate, week]);

  const reload = useCallback(async () => {
    if (!isIsoWeek(week)) {
      onNotice('周格式应为 YYYY-Www，例如 2026-W36。');
      return;
    }
    setLoading(true);
    try {
      const [nextPoints, nextSummary, nextRecords, nextStats] = await Promise.all([
        fetchPoints(week),
        fetchMyWeeklySummary(week),
        fetchMyRecords(recordsQuery),
        fetchMyWeeklyStats()
      ]);
      setPoints(nextPoints);
      setSummary(nextSummary);
      setRecords(nextRecords);
      setStats(nextStats);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '个人专注数据加载失败。');
    } finally {
      setLoading(false);
    }
  }, [onNotice, recordsQuery, week]);

  useEffect(() => { void reload(); }, [reload]);

  const applyWeek = (event: FormEvent) => {
    event.preventDefault();
    if (!isIsoWeek(week)) return onNotice('周格式应为 YYYY-Www，例如 2026-W36。');
    setRecordsPage(1);
    void reload();
  };

  const applyDateFilter = () => {
    if (startDate && endDate && startDate > endDate) return onNotice('开始日期不能晚于结束日期。');
    setRecordsPage(1);
  };

  return <div className="page personal-progress-page">
    <section className="welcome-row">
      <div><p className="eyebrow">MY FOCUS & POINTS</p><h1>我的<span>专注</span></h1><p>积分、周汇总和打卡记录均从服务端读取；积分不在桌面端估算。</p></div>
      <form className="week-picker" onSubmit={applyWeek}><button type="button" aria-label="上一周" onClick={() => { try { setWeek((value) => shiftIsoWeek(value, -1)); setRecordsPage(1); } catch { onNotice('当前周格式无效，无法切换。'); } }}><ChevronLeft size={16} /></button><CalendarDays size={16} /><input aria-label="ISO 周" value={week} onChange={(event) => setWeek(event.target.value.toUpperCase())} pattern="\\d{4}-W\\d{2}" maxLength={8} /><button type="button" aria-label="下一周" onClick={() => { try { setWeek((value) => shiftIsoWeek(value, 1)); setRecordsPage(1); } catch { onNotice('当前周格式无效，无法切换。'); } }}><ChevronRight size={16} /></button><button type="submit">查询</button></form>
    </section>

    <section className="personal-summary-grid">
      <article className="blue-card personal-metric"><CircleDollarSign size={20} /><small>本周积分</small><strong>{points?.weekPoints?.toLocaleString() ?? '—'}</strong><span>总积分 {points?.totalPoints?.toLocaleString() ?? '—'} · 积分自功能上线日起算</span></article>
      <article className="blue-card personal-metric"><TimerReset size={20} /><small>本周有效时长</small><strong>{summary ? formatMinutes(summary.totalFocusedMinutes) : '—'}</strong><span>{summary?.adjustmentsCount ? `含 ${summary.adjustmentsCount} 条管理员调整` : '仅原始打卡时长'}</span></article>
      <article className="blue-card personal-metric"><History size={20} /><small>原始打卡时长</small><strong>{summary ? formatMinutes(summary.rawFocusedMinutes) : '—'}</strong><span>{summary ? `调整净额 ${formatMinutes(summary.adjustedMinutes)}` : '—'}</span></article>
      <article className="blue-card personal-metric"><CalendarDays size={20} /><small>本周打卡天数</small><strong>{summary?.checkedInDays ?? '—'}</strong><span>{summary ? `${summary.days.length} 天已有原始记录` : '—'}</span></article>
    </section>

    <section className="personal-progress-grid">
      <article className="blue-card progress-card"><header><div><p className="eyebrow">WEEKLY SUMMARY</p><h2>本周汇总</h2></div><button className="admin-reload" onClick={() => void reload()} disabled={loading}><RefreshCw size={14} />刷新</button></header>{loading && !summary ? <p className="admin-empty">正在读取服务端汇总…</p> : summary ? <><div className="day-summary-list">{summary.days.map((day) => <div key={day.date}><time>{day.date.slice(5).replace('-', '/')}</time><strong>{formatMinutes(day.focusedMinutes)}</strong><span>{day.sessions} 次 · {day.points} 分</span></div>)}</div><p className="personal-raw-note">每日明细只统计原始打卡；管理员调整按周生效，因此不会被分配到任意一天。</p></> : <p className="admin-empty">暂无该周汇总。</p>}</article>
      <article className="blue-card adjustment-card"><header><div><p className="eyebrow">TRANSPARENT ADJUSTMENTS</p><h2>时长调整说明</h2></div><ShieldCheck size={18} /></header>{summary?.adjustmentsCount ? <ol>{summary.adjustments.map((adjustment, index) => <li key={`${adjustment.createdAt}-${index}`}><i className={adjustment.operation === 'subtract' ? 'subtract' : 'add'}>{adjustment.operation === 'subtract' ? '扣除' : '增加'}</i><strong>{formatSeconds(adjustment.durationSeconds)}</strong><p>{adjustment.reason}</p><small>{formatDateTime(adjustment.createdAt)}</small></li>)}</ol> : <p className="admin-empty">本周没有管理员时长调整。</p>}</article>
    </section>

    <section className="blue-card records-card"><header><div><p className="eyebrow">MY ATTENDANCE RECORDS</p><h2>打卡记录</h2></div><div className="records-filter"><label>开始<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>结束<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><button onClick={applyDateFilter}>按日期筛选</button><button className="records-reset" onClick={() => { setStartDate(''); setEndDate(''); setRecordsPage(1); }}>当前周</button></div></header><p className="personal-raw-note">未填写日期时按所选 ISO 周查询；日期筛选只影响原始打卡记录，不影响周级管理员调整。</p>{records?.items.length ? <div className="record-table"><div className="record-table-head"><span>上卡</span><span>下卡</span><span>时长</span><span>状态</span></div>{records.items.map((record) => <div className="record-table-row" key={record.id}><span>{formatDateTime(record.checkInAt)}</span><span>{formatDateTime(record.checkOutAt)}</span><strong>{formatSeconds(record.durationSeconds)}</strong><i className={`record-status ${record.status}`}>{record.status === 'completed' ? (record.isMarked ? '已标记' : '已完成') : record.status === 'active' ? '进行中' : '已失效'}</i></div>)}</div> : <p className="admin-empty">{loading ? '正在读取记录…' : '没有符合条件的打卡记录。'}</p>}<div className="records-pagination"><button disabled={recordsPage <= 1 || loading} onClick={() => setRecordsPage((page) => Math.max(1, page - 1))}>上一页</button><span>第 {records?.page ?? recordsPage} 页</span><button disabled={!records?.items.length || loading} onClick={() => setRecordsPage((page) => page + 1)}>下一页</button></div></section>

    <section className="blue-card personal-history-card"><header><div><p className="eyebrow">RECENT WEEKS</p><h2>近六周趋势</h2></div><span>周目标 {stats ? formatSeconds(stats.weeklyGoalSeconds) : '—'}</span></header>{stats?.items.length ? <div className="personal-history-list">{stats.items.map((item) => <div key={item.weekKey}><strong>{item.weekKey}</strong><span>{formatSeconds(item.totalDurationSeconds)}</span><small>{item.sessionsCount} 次打卡{item.adjustmentsCount ? ` · 含 ${item.adjustmentsCount} 条调整` : ''}</small></div>)}</div> : <p className="admin-empty">暂无个人周统计。</p>}</section>
  </div>;
};
