import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BookOpenText, CheckCircle2, Clipboard, Download, FileText, GitBranch, Link2, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { deleteGitHubSource, fetchGitHubSource, fetchMyWeeklyReport, isAdminPreviewSession, saveGitHubSource, saveMyWeeklyReport } from '@/lib/api';
import { buildWeeklyMarkdown, loadDailyLogsForWeek, previewDailyLogs, rawUrlFromGitHubSource, weekDates, type DailyLog } from '@/lib/blog';
import { openExternalUrl, saveMarkdownLocally } from '@/lib/desktop';
import { getShanghaiIsoWeek, isIsoWeek } from '@/lib/week';
import type { GitHubSourceItem, MyWeeklyReportResponse } from '@/types';

const defaultWeeklyPath = (week: string) => `public/blogs/weekly-${week.toLowerCase()}/index.md`;

export const WeeklyReportWorkspace = ({ onNotice }: { onNotice: (message: string) => void }) => {
  const [week, setWeek] = useState(getShanghaiIsoWeek);
  const [source, setSource] = useState<GitHubSourceItem | null>(null);
  const [report, setReport] = useState<MyWeeklyReportResponse | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [indexPath, setIndexPath] = useState('public/blogs/index.json');
  const [sourceEnabled, setSourceEnabled] = useState(true);
  const [weeklyPath, setWeeklyPath] = useState(defaultWeeklyPath(getShanghaiIsoWeek()));
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [ignoredUnsafeEntries, setIgnoredUnsafeEntries] = useState(0);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!isIsoWeek(week)) return onNotice('周格式应为 YYYY-Www，例如 2026-W36。');
    setLoading(true);
    try {
      const [sourceResult, reportResult] = await Promise.all([fetchGitHubSource(), fetchMyWeeklyReport(week)]);
      setSource(sourceResult.item);
      if (sourceResult.item) {
        setRepoUrl(sourceResult.item.repoUrl);
        setSiteUrl(sourceResult.item.siteUrl || '');
        setBranch(sourceResult.item.branch);
        setIndexPath(sourceResult.item.indexPath);
        setSourceEnabled(sourceResult.item.enabled);
      } else {
        setRepoUrl(''); setSiteUrl(''); setBranch('main'); setIndexPath('public/blogs/index.json'); setSourceEnabled(true);
      }
      setReport(reportResult);
      setWeeklyPath(reportResult.item?.githubPath || defaultWeeklyPath(week));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '周报设置加载失败。');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const saveSource = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await saveGitHubSource({ repoUrl: repoUrl.trim(), siteUrl: siteUrl.trim() || null, branch: branch.trim() || undefined, indexPath: indexPath.trim() || undefined, accessMode: 'public', enabled: sourceEnabled });
      setSource(result.item);
      onNotice('GitHub 日报来源与博客主页已保存。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'GitHub 来源保存失败。');
    } finally {
      setSaving(false);
    }
  };

  const removeSource = async () => {
    if (!source || !window.confirm('删除 GitHub 来源配置？这不会删除你的 GitHub 仓库或文章。')) return;
    try {
      await deleteGitHubSource();
      setSource(null); setRepoUrl(''); setSiteUrl(''); setLogs([]); setDraft('');
      onNotice('GitHub 来源已删除。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'GitHub 来源删除失败。');
    }
  };

  const pullDailyLogs = async () => {
    if (!source || !source.enabled) return onNotice('请先保存并启用自己的公开 GitHub 日报来源。');
    if (!isIsoWeek(week)) return onNotice('周格式应为 YYYY-Www，例如 2026-W36。');
    setPulling(true);
    try {
      const result = isAdminPreviewSession() ? previewDailyLogs(week) : await loadDailyLogsForWeek(source, week);
      setLogs(result.logs);
      setIgnoredUnsafeEntries(result.ignoredUnsafeEntries);
      setDraft('');
      onNotice(`已读取 ${result.logs.length} 篇本周日报；正文只在本地用于生成草稿。`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '日报索引读取失败。');
    } finally {
      setPulling(false);
    }
  };

  const generateDraft = () => {
    if (!logs.length) return onNotice('请先拉取本周日报。');
    setDraft(buildWeeklyMarkdown(week, logs, report?.attendanceSummary || null));
    onNotice('本周 Markdown 草稿已在本地生成，请确认后自行发布到个人博客。');
  };

  const copyDraft = async () => {
    if (!draft) return onNotice('请先生成周报草稿。');
    try {
      await navigator.clipboard.writeText(draft);
      onNotice('周报 Markdown 已复制到剪贴板。');
    } catch {
      onNotice('无法访问剪贴板，请使用下载 .md 文件。');
    }
  };

  const downloadDraft = async () => {
    if (!draft) return onNotice('请先生成周报草稿。');
    try {
      const result = await saveMarkdownLocally(`${week}-weekly-report.md`, draft);
      if (result.saved) onNotice('周报 Markdown 已保存到本地。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '本地保存失败。');
    }
  };

  const openMyBlog = async () => {
    if (!source?.siteUrl) return onNotice('请先在“博客主页地址”中保存公开 HTTPS 博客地址。');
    try {
      await openExternalUrl(source.siteUrl);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '无法打开个人博客。');
    }
  };

  const openPublishedReport = async () => {
    if (!report?.item?.rawUrl) return onNotice('本周尚未标记为已发布。');
    try {
      await openExternalUrl(report.item.rawUrl);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '无法打开已发布周报。');
    }
  };

  const markPublished = async () => {
    if (!source || !source.enabled) return onNotice('请先保存并启用公开日报来源。');
    if (!isIsoWeek(week)) return onNotice('周格式应为 YYYY-Www，例如 2026-W36。');
    let rawUrl: string;
    try {
      rawUrl = rawUrlFromGitHubSource(source, weeklyPath);
    } catch (error) {
      return onNotice(error instanceof Error ? error.message : '周报路径无效。');
    }
    setSaving(true);
    try {
      if (!isAdminPreviewSession()) {
        const response = await fetch(rawUrl, { credentials: 'omit', cache: 'no-store' });
        if (!response.ok) throw new Error(`未找到已发布的周报（HTTP ${response.status}）。请先在个人博客发布，再标记。`);
      }
      const result = await saveMyWeeklyReport(week, { status: 'generated', githubPath: weeklyPath.trim(), rawUrl, dailyLogCount: logs.length });
      setReport((current) => current ? { ...current, item: result.item } : current);
      onNotice('已验证公开 Raw 地址并标记本周周报已发布。');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '周报发布状态保存失败。');
    } finally {
      setSaving(false);
    }
  };

  const dailyByDate = useMemo(() => {
    const map = new Map<string, DailyLog[]>();
    logs.forEach((log) => map.set(log.reportDate, [...(map.get(log.reportDate) || []), log]));
    return map;
  }, [logs]);
  const rawPreview = useMemo(() => {
    try { return source ? rawUrlFromGitHubSource(source, weeklyPath) : ''; } catch { return ''; }
  }, [source, weeklyPath]);

  return <section className="weekly-api-workspace">
    <div className="report-api-header"><div><p className="eyebrow">MY WEEKLY REPORT</p><h2>我的本周周报</h2><p>Election 只读取公开 GitHub Markdown 并在本地生成草稿，不会写入 GitHub、不会持有 Token 或私钥。</p></div><button className="admin-reload" onClick={() => void load()} disabled={loading}><RefreshCw size={14} />刷新</button></div>
    <div className="weekly-api-grid"><form className="blue-card weekly-source-card" onSubmit={saveSource}><header><GitBranch size={19} /><div><h3>我的公开博客</h3><p>仓库用于读取日报；博客主页用于方便成员与团队访问。</p></div></header><label>公开仓库 URL<input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/用户名/仓库" required /></label><label>博客主页地址（可选，HTTPS）<input value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://你的博客域名" maxLength={255} /></label><div className="weekly-form-two"><label>分支<input value={branch} onChange={(event) => setBranch(event.target.value)} maxLength={128} /></label><label>日报索引路径<input value={indexPath} onChange={(event) => setIndexPath(event.target.value)} maxLength={256} /></label></div><label className="inline-check"><input type="checkbox" checked={sourceEnabled} onChange={(event) => setSourceEnabled(event.target.checked)} />在团队博客墙中展示此公开来源</label><div className="weekly-actions"><button className="profile-save" disabled={saving}>{saving ? '保存中…' : '保存来源'}<Save size={15} /></button>{source ? <button type="button" className="soft-danger" onClick={() => void removeSource()}><Trash2 size={14} />删除配置</button> : null}</div></form>
      <section className="blue-card weekly-reference-card"><header><BookOpenText size={19} /><div><h3>{week} 周报草稿</h3><p>打卡数据：{report ? `${report.attendanceSummary.totalFocusedMinutes} 分钟` : '—'}{report?.attendanceSummary.adjustmentsCount ? ` · 含 ${report.attendanceSummary.adjustmentsCount} 条管理员调整` : ''}</p></div></header><label>ISO 周<input value={week} onChange={(event) => setWeek(event.target.value.toUpperCase())} pattern="\d{4}-W\d{2}" maxLength={8} /></label><label>已发布周报的仓库路径<input value={weeklyPath} onChange={(event) => setWeeklyPath(event.target.value)} placeholder="public/blogs/weekly-2026-w36/index.md" /></label>{rawPreview ? <p className="weekly-raw-preview"><Link2 size={13} />发布后将验证：<code>{rawPreview}</code></p> : null}<div className="weekly-draft-actions"><button onClick={() => void pullDailyLogs()} disabled={pulling || saving}><RefreshCw size={14} />{pulling ? '拉取中…' : '拉取本周日报'}</button><button onClick={generateDraft} disabled={!logs.length || saving}><Sparkles size={14} />生成周报草稿</button><button onClick={() => void copyDraft()} disabled={!draft}><Clipboard size={14} />复制 Markdown</button><button onClick={() => void downloadDraft()} disabled={!draft}><Download size={14} />下载 .md</button><button onClick={() => void openMyBlog()} disabled={!source?.siteUrl}><Link2 size={14} />打开我的博客</button></div><div className="weekly-publish-row"><span>{report?.item?.status === 'generated' ? '本周已标记为已发布' : '在博客自行发布后，再完成地址验证'}</span><div><button className="weekly-open-published" onClick={() => void openPublishedReport()} disabled={!report?.item?.rawUrl}><Link2 size={14} />查看已发布周报</button><button className="profile-save" onClick={() => void markPublished()} disabled={saving || !source}><CheckCircle2 size={15} />验证并标记已发布</button></div></div></section></div>
    <section className="blue-card weekly-daily-status"><header><div><p className="eyebrow">DAILY LOGS</p><h3>本周日报读取状态</h3></div><span>{logs.length} 篇已找到</span></header><div className="daily-status-grid">{weekDates(week).map((date) => { const entries = dailyByDate.get(date) || []; return <article key={date} className={entries.some((entry) => entry.markdown) ? 'found' : entries.length ? 'failed' : ''}><strong>{date}</strong>{entries.length ? entries.map((entry) => <small key={entry.path}>{entry.markdown ? `已找到 · ${entry.title}` : `读取失败 · ${entry.title}`}</small>) : <small>未提交</small>}</article>; })}</div>{ignoredUnsafeEntries ? <p className="weekly-safety-note">已忽略 {ignoredUnsafeEntries} 条不安全索引路径（禁止绝对路径、协议与 ..）。</p> : null}</section>
    {draft ? <section className="blue-card weekly-draft-preview"><header><div><p className="eyebrow">LOCAL MARKDOWN DRAFT</p><h3>本地草稿预览</h3></div><FileText size={18} /></header><pre>{draft}</pre></section> : null}
  </section>;
};
