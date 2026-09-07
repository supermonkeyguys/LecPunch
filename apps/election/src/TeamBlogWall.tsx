import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, ExternalLink, GitBranch, RefreshCw } from 'lucide-react';
import { fetchTeamGitHubSources } from '@/lib/api';
import { openExternalUrl } from '@/lib/desktop';
import type { TeamGitHubSourceItem, TeamWeeklyStat } from '@/types';

export const TeamBlogWall = ({ teamStats, onNotice }: { teamStats: TeamWeeklyStat[]; onNotice: (message: string) => void }) => {
  const [sources, setSources] = useState<TeamGitHubSourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setSources((await fetchTeamGitHubSources()).items);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '团队博客墙加载失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  const unboundNames = useMemo(() => {
    const boundNames = new Set(sources.map((source) => source.displayName));
    return teamStats.map((member) => member.displayName).filter((name, index, all) => !boundNames.has(name) && all.indexOf(name) === index);
  }, [sources, teamStats]);
  const open = async (url: string) => {
    try {
      await openExternalUrl(url);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '无法打开外部地址。');
    }
  };

  return <section className="team-blog-wall blue-card">
    <header className="team-blog-wall-head"><div><p className="eyebrow">TEAM BLOG WALL</p><h2>团队博客墙</h2><p>只显示成员主动启用的公开来源；博客与仓库均在系统浏览器中打开。</p></div><button className="admin-reload" onClick={() => void load()} disabled={loading}><RefreshCw size={14} />刷新</button></header>
    {sources.length ? <div className="team-blog-grid">{sources.map((source) => <article key={`${source.displayName}-${source.repoUrl}`} className="team-blog-card"><div className="team-blog-avatar">{source.displayName.slice(0, 1)}</div><div className="team-blog-copy"><strong>{source.displayName}</strong><small>{source.siteUrl ? '已绑定公开博客' : '未设置博客主页，可访问仓库'}</small></div><div className="team-blog-actions"><button disabled={!source.siteUrl} title={source.siteUrl ? '在系统浏览器打开博客' : '该成员未设置博客主页'} onClick={() => source.siteUrl && void open(source.siteUrl)}><BookOpenText size={14} />打开博客</button><button onClick={() => void open(source.repoUrl)}><GitBranch size={14} />GitHub 仓库<ExternalLink size={12} /></button></div></article>)}</div> : <p className="admin-empty">{loading ? '正在读取团队公开博客…' : '当前没有已启用的公开博客来源。'}</p>}
    {unboundNames.length ? <div className="team-blog-unbound"><small>未绑定或未启用博客</small><span>{unboundNames.join('、')}</span></div> : null}
  </section>;
};
