import { isoWeekToShanghaiMonday } from '@/lib/week';
import type { AttendanceWeeklySummary, GitHubSourceItem } from '@/types';

type BlogIndexEntry = {
  slug?: unknown;
  path?: unknown;
  title?: unknown;
  category?: unknown;
  reportDate?: unknown;
  date?: unknown;
  hidden?: unknown;
};

export type DailyLog = {
  title: string;
  reportDate: string;
  path: string;
  rawUrl: string;
  markdown: string | null;
  error: string | null;
};

export type DailyLogLoad = {
  indexUrl: string;
  logs: DailyLog[];
  ignoredUnsafeEntries: number;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REPOSITORY_PATTERN = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/;
const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;

const relativePath = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const path = value.trim().replace(/\\/g, '/');
  if (!path || path.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.includes('?') || path.includes('#')) return null;
  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0'))) return null;
  return segments.join('/');
};

const sourceRoot = (source: Pick<GitHubSourceItem, 'repoUrl' | 'branch'>) => {
  const repository = REPOSITORY_PATTERN.exec(source.repoUrl.trim());
  const branch = source.branch.trim();
  if (!repository || !BRANCH_PATTERN.test(branch) || branch.includes('..') || branch.includes('://')) {
    throw new Error('GitHub 来源配置不符合公开仓库读取规则。');
  }
  return `https://raw.githubusercontent.com/${repository[1]}/${repository[2]}/${branch.split('/').map(encodeURIComponent).join('/')}`;
};

/** Derives a raw GitHub URL only from the member's bound source configuration. */
export const rawUrlFromGitHubSource = (source: Pick<GitHubSourceItem, 'repoUrl' | 'branch'>, repositoryPath: string) => {
  const safePath = relativePath(repositoryPath);
  if (!safePath) throw new Error('仓库路径不安全：不能使用绝对路径、协议或 ..。');
  return `${sourceRoot(source)}/${safePath.split('/').map(encodeURIComponent).join('/')}`;
};

export const weekDates = (week: string) => {
  const monday = isoWeekToShanghaiMonday(week);
  const start = new Date(`${monday}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(start.valueOf() + offset * 86_400_000);
    return day.toISOString().slice(0, 10);
  });
};

const entryDate = (entry: BlogIndexEntry) => {
  const candidate = typeof entry.reportDate === 'string' ? entry.reportDate : entry.date;
  const date = typeof candidate === 'string' ? candidate.slice(0, 10) : '';
  return DATE_PATTERN.test(date) ? date : null;
};

const entryPath = (entry: BlogIndexEntry, indexPath: string) => {
  if (typeof entry.path === 'string') return relativePath(entry.path);
  const slug = relativePath(entry.slug);
  if (!slug) return null;
  const directory = indexPath.split('/').slice(0, -1).join('/');
  return `${directory ? `${directory}/` : ''}${slug}/index.md`;
};

const readPublicText = async (url: string) => {
  let response: Response;
  try {
    response = await fetch(url, { credentials: 'omit', cache: 'no-store' });
  } catch {
    throw new Error('无法访问公开 GitHub 内容，请检查网络或仓库可见性。');
  }
  if (!response.ok) throw new Error(`公开内容返回 HTTP ${response.status}。`);
  return response.text();
};

const indexEntries = (value: unknown): BlogIndexEntry[] => {
  const entries = Array.isArray(value) ? value : (value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items) ? (value as { items: unknown[] }).items : null);
  if (!entries) throw new Error('日报索引必须是数组，或包含 items 数组。');
  return entries.filter((entry): entry is BlogIndexEntry => Boolean(entry) && typeof entry === 'object');
};

/** Reads only public raw GitHub Markdown. No GitHub token, write API, or LecPunch credential is used. */
export const loadDailyLogsForWeek = async (source: Pick<GitHubSourceItem, 'repoUrl' | 'branch' | 'indexPath'>, week: string): Promise<DailyLogLoad> => {
  const indexPath = relativePath(source.indexPath);
  if (!indexPath) throw new Error('日报索引路径不安全：不能使用绝对路径、协议或 ..。');
  const indexUrl = rawUrlFromGitHubSource(source, indexPath);
  const index = indexEntries(JSON.parse(await readPublicText(indexUrl)));
  const dates = new Set(weekDates(week));
  let ignoredUnsafeEntries = 0;
  const selected = index.flatMap((entry) => {
    const date = entryDate(entry);
    if (entry.category !== 'daily' || entry.hidden === true || !date || !dates.has(date)) return [];
    const path = entryPath(entry, indexPath);
    if (!path) {
      ignoredUnsafeEntries += 1;
      return [];
    }
    return [{
      title: typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : '未命名日报',
      reportDate: date,
      path,
      rawUrl: rawUrlFromGitHubSource(source, path)
    }];
  }).sort((left, right) => left.reportDate.localeCompare(right.reportDate) || left.path.localeCompare(right.path));

  const logs = await Promise.all(selected.map(async (entry): Promise<DailyLog> => {
    try {
      return { ...entry, markdown: await readPublicText(entry.rawUrl), error: null };
    } catch (error) {
      return { ...entry, markdown: null, error: error instanceof Error ? error.message : '日报正文读取失败。' };
    }
  }));
  return { indexUrl, logs, ignoredUnsafeEntries };
};

export const previewDailyLogs = (week: string): DailyLogLoad => {
  const dates = weekDates(week);
  return {
    indexUrl: 'https://raw.githubusercontent.com/local-preview/daily-log/main/public/blogs/index.json',
    ignoredUnsafeEntries: 0,
    logs: [
      { title: '完成桌面端交互梳理', reportDate: dates[0], path: `public/blogs/${dates[0]}-desktop/index.md`, rawUrl: 'https://raw.githubusercontent.com/local-preview/daily-log/main/public/blogs/demo-a/index.md', markdown: '今天完成了桌面端交互梳理，确认了打卡与周报的使用路径。', error: null },
      { title: '整理日报索引规范', reportDate: dates[2], path: `public/blogs/${dates[2]}-daily/index.md`, rawUrl: 'https://raw.githubusercontent.com/local-preview/daily-log/main/public/blogs/demo-b/index.md', markdown: '补充了日报索引字段，并验证了按上海 ISO 周筛选的结果。', error: null },
      { title: '本周复盘', reportDate: dates[4], path: `public/blogs/${dates[4]}-review/index.md`, rawUrl: 'https://raw.githubusercontent.com/local-preview/daily-log/main/public/blogs/demo-c/index.md', markdown: '完成本周复盘，下一步会把周报草稿自行发布到个人博客。', error: null }
    ]
  };
};

const minutes = (value: number) => `${Math.max(0, value)} 分钟`;

/** Produces a local Markdown draft only. Publication stays with the member's own blog editor. */
export const buildWeeklyMarkdown = (week: string, logs: DailyLog[], attendance: AttendanceWeeklySummary | null) => {
  const lines = [
    `# ${week} 周报`,
    '',
    '> 本文由 LecPunch Election 在本地汇总生成；请在确认后自行发布到个人 GitHub 博客。',
    '',
    '## 本周打卡',
    attendance ? `- 有效时长：${minutes(attendance.totalFocusedMinutes)}` : '- 有效时长：暂未读取',
    attendance ? `- 原始打卡时长：${minutes(attendance.rawFocusedMinutes)}` : '',
    attendance ? `- 打卡天数：${attendance.checkedInDays} 天` : ''
  ].filter(Boolean);
  if (attendance?.adjustmentsCount) {
    lines.push('', '### 管理员时长调整');
    attendance.adjustments.forEach((adjustment) => {
      const direction = adjustment.operation === 'add' ? '增加' : '扣除';
      lines.push(`- ${direction} ${minutes(Math.round(adjustment.durationSeconds / 60))}：${adjustment.reason || '未填写原因'}`);
    });
  }
  lines.push('', '## 每日总结');
  if (!logs.length) lines.push('', '本周尚未找到符合 category: daily 且日期在本周内的公开日报。');
  logs.forEach((log) => {
    lines.push('', `### ${log.reportDate} · ${log.title}`, '', log.markdown?.trim() || `> 日报正文未能读取：${log.error || '未知原因'}`);
  });
  lines.push('', '## 下周计划', '', '- [ ] ', '');
  return lines.join('\n');
};
