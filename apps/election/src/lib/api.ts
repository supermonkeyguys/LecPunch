import type {
  AdminNetworkPolicy,
  AdminReportsResponse,
  AdminDurationAdjustment,
  AdminWeeklyReportsResponse,
  AttendanceSnapshot,
  AttendanceWeeklySummary,
  ElectionNotification,
  ElectionUser,
  GitHubSourceItem,
  MemberEligibilityEntry,
  MemberWeeklyStatsResponse,
  MyRecordsResponse,
  MyWeeklyStatsResponse,
  NetworkPolicyStatus,
  PointsSummary,
  ShopUnlockResponse,
  ShopUnlocksResponse,
  ReportItem,
  TeamEventItem,
  TeamGitHubSourcesResponse,
  TeamLedgerEntry,
  TeamLedgerSummary,
  TeamLedgerTrendItem,
  TeamActiveAttendance,
  TeamWeeklyStatsResponse,
  WeeklyReportReference,
  MyWeeklyReportResponse,
  MeetTokenResponse
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://43.138.244.158/api';
const TOKEN_KEY = 'lecpunch.election.token';
const ADMIN_PREVIEW_SESSION_KEY = 'lecpunch.election.admin-preview';
export const AUTH_EXPIRED_EVENT = 'lecpunch.election.auth-expired';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly payload?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let previewUser: ElectionUser = {
  id: 'preview-admin-001',
  username: 'local-preview-admin',
  displayName: '林予安',
  realName: '林予安',
  role: 'admin',
  status: 'active',
  teamId: 'preview-focus-team',
  enrollYear: 2023,
  studentId: '202301010001',
  avatarEmoji: '🐱',
  avatarColor: '#58b9e8'
};

let previewMembers: ElectionUser[] = [
  previewUser,
  { id: 'preview-member-001', username: 'chenxi', displayName: '晨曦', realName: '陈曦', role: 'member', status: 'active', teamId: 'preview-focus-team', enrollYear: 2025, studentId: '202501010028', avatarEmoji: '🌤️', avatarColor: '#78c9ee' },
  { id: 'preview-member-002', username: 'moyu', displayName: '墨宇', realName: '周墨宇', role: 'member', status: 'active', teamId: 'preview-focus-team', enrollYear: 2025, studentId: '202501010034', avatarEmoji: '🪐', avatarColor: '#7cb4e8' },
  { id: 'preview-member-003', username: 'xiaoyu', displayName: '小雨', realName: '李雨桐', role: 'member', status: 'active', teamId: 'preview-focus-team', enrollYear: 2024, studentId: '202401010016', avatarEmoji: '☔', avatarColor: '#9ccff0' },
  { id: 'preview-member-004', username: 'yuanzi', displayName: '原子', realName: '吴原', role: 'member', status: 'active', teamId: 'preview-focus-team', enrollYear: 2024, studentId: '202401010042', avatarEmoji: '⚛️', avatarColor: '#78bfe5' },
  { id: 'preview-member-005', username: 'qingtian', displayName: '青田', realName: '张青田', role: 'member', status: 'disabled', teamId: 'preview-focus-team', enrollYear: 2023, studentId: '202301010067', avatarEmoji: '🌿', avatarColor: '#98d9cf' },
  { id: 'preview-member-006', username: 'nina', displayName: 'Nina', realName: '王宁', role: 'member', status: 'active', teamId: 'preview-focus-team', enrollYear: 2023, studentId: '202301010075', avatarEmoji: '🫧', avatarColor: '#94c8f1' }
];

let previewPolicy: AdminNetworkPolicy = {
  teamId: 'preview-focus-team',
  source: 'database',
  allowAnyNetwork: false,
  allowedPublicIps: ['43.138.244.158', '203.0.113.16'],
  allowedCidrs: ['10.12.0.0/16'],
  trustProxy: true,
  trustedProxyHops: 1,
  updatedAt: '2026-09-01T12:00:00.000Z'
};

let previewAttendance: AttendanceSnapshot = { hasActiveSession: false, session: null };
let previewReports: ReportItem[] = [{
  id: 'preview-report-001',
  teamId: 'preview-focus-team',
  reporter: { userId: 'preview-member-003', username: 'xiaoyu', displayName: '小雨' },
  description: '演示请假申请：晚间课程冲突，已附图说明。',
  images: [],
  imagesExpireAt: null,
  imagesPurgedAt: null,
  createdAt: '2026-09-02T11:30:00.000Z'
}];
let previewNotifications: ElectionNotification[] = [{
  id: 'preview-notification-001',
  teamId: 'preview-focus-team',
  userId: 'preview-admin-001',
  type: 'report.submitted',
  title: '收到新的请假申请',
  message: '小雨提交了一条请假申请，请及时查看。',
  payload: { reportId: 'preview-report-001', reporterDisplayName: '小雨', imageCount: 0, imagesExpireAt: null },
  sourceType: 'report',
  sourceId: 'preview-report-001',
  createdBy: 'preview-member-003',
  createdAt: '2026-09-02T11:30:00.000Z',
  acknowledgedAt: null
}];
let previewShopPoints = 1840;
const previewUnlockedSkinIds = new Set<string>();

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const isAdminPreviewSession = () => localStorage.getItem(ADMIN_PREVIEW_SESSION_KEY) === 'true';
export const getApiBaseUrl = () => API_BASE_URL;
export const readToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_PREVIEW_SESSION_KEY);
};

const toMessage = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').join('；') || fallback;
  return fallback;
};

const errorMessageForStatus = (status: number, payload: { message?: unknown } | null) => {
  if (status === 401) return '登录已失效，请重新登录。';
  if (status === 403) return '当前账号没有执行此操作的权限。';
  if (status === 413) return '图片过大，请将每张图片控制在 3MB 以内。';
  if (status === 415) return '仅支持 JPG、PNG 或 WebP 格式图片。';
  return toMessage(payload?.message, '请求未能完成，请稍后重试。');
};

const dispatchAuthExpired = () => {
  clearToken();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
};

const requestResponse = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const token = readToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const usesFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!usesFormData && init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, `无法连接 LecPunch 服务端（${API_BASE_URL}）。请检查网络后重试。`);
  }

  if (response.ok) return response;
  const payload = await response.json().catch(() => null) as { message?: unknown; code?: string } | null;
  if (response.status === 401) dispatchAuthExpired();
  throw new ApiError(response.status, errorMessageForStatus(response.status, payload), payload?.code, payload);
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await requestResponse(path, init);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

const requestBlob = async (path: string) => {
  const response = await requestResponse(path, { headers: { Accept: 'image/jpeg,image/png,image/webp' } });
  return response.blob();
};

const requestDownload = async (path: string) => {
  const response = await requestResponse(path, { headers: { Accept: 'text/csv,application/octet-stream' } });
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null) as { status?: string } | null;
    if (payload?.status === 'not_implemented') throw new ApiError(501, '服务端尚未实现该 CSV 导出。');
  }
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || 'lecpunch-export.csv';
  return { blob: await response.blob(), filename };
};

/** Starts the bundled UI preview without manufacturing or submitting credentials. */
export const enterAdminPreview = () => {
  localStorage.setItem(ADMIN_PREVIEW_SESSION_KEY, 'true');
  localStorage.setItem(TOKEN_KEY, 'local-admin-preview');
  return clone(previewUser);
};

export const login = async (username: string, password: string) => {
  const result = await request<{ accessToken: string; user: ElectionUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  localStorage.setItem(TOKEN_KEY, result.accessToken);
  return result.user;
};

/** The server signs a five-minute, room-scoped Jitsi token. It is never persisted. */
export const fetchMeetToken = (room: string) => {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(room)) return Promise.reject(new ApiError(400, '房间名格式无效。'));
  if (isAdminPreviewSession()) return Promise.reject(new ApiError(400, '本地演示模式不会请求会议令牌。'));
  return request<MeetTokenResponse>(`/meet/token?room=${encodeURIComponent(room)}`);
};

export const fetchCurrentUser = () => isAdminPreviewSession() ? Promise.resolve(clone(previewUser)) : request<ElectionUser>('/auth/me');
export const updateProfile = async (input: string | { displayName?: string; avatarBase64?: string }) => {
  if (isAdminPreviewSession()) {
    const payload = typeof input === 'string' ? { displayName: input } : input;
    previewUser = { ...previewUser, ...payload };
    previewMembers = previewMembers.map((member) => member.id === previewUser.id ? previewUser : member);
    return clone(previewUser);
  }
  return request<ElectionUser>('/users/me', { method: 'PATCH', body: JSON.stringify(typeof input === 'string' ? { displayName: input } : input) });
};
export const updatePassword = (oldPassword: string, newPassword: string) => isAdminPreviewSession()
  ? Promise.resolve({})
  : request('/users/me/password', { method: 'PATCH', body: JSON.stringify({ oldPassword, newPassword }) });
export const fetchAttendance = () => isAdminPreviewSession() ? Promise.resolve(clone(previewAttendance)) : request<AttendanceSnapshot>('/attendance/current');
const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/;
const previewWeek = (week?: string) => week && ISO_WEEK_PATTERN.test(week) ? week : '2026-W36';

/** Points always come from the server ledger; this client deliberately does no point calculation. */
export const fetchPoints = (week?: string) => {
  if (week && !ISO_WEEK_PATTERN.test(week)) return Promise.reject(new ApiError(400, '周格式应为 YYYY-Www，例如 2026-W36。'));
  const currentWeek = previewWeek(week);
  if (isAdminPreviewSession()) return Promise.resolve({
    totalPoints: previewShopPoints,
    week: currentWeek,
    weekPoints: 286,
    accrualRate: { focusedMinutes: 1, points: 1 },
    calculatedAt: '2026-09-02T12:00:00.000Z'
  } satisfies PointsSummary);
  return request<PointsSummary>(`/points/me${week ? `?week=${encodeURIComponent(week)}` : ''}`);
};

/** Server-backed unlock state; preview keeps its entire simulation in memory. */
export const fetchShopUnlocks = () => isAdminPreviewSession()
  ? Promise.resolve({ skinIds: [...previewUnlockedSkinIds] } satisfies ShopUnlocksResponse)
  : request<ShopUnlocksResponse>('/shop/unlocks');

export const unlockShopSkin = async (skinId: string) => {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(skinId)) return Promise.reject(new ApiError(400, '皮肤标识无效。'));
  if (isAdminPreviewSession()) {
    const alreadyUnlocked = previewUnlockedSkinIds.has(skinId);
    if (!alreadyUnlocked && previewShopPoints < 600) throw new ApiError(400, '积分不足 600，暂时无法解锁该皮肤。', 'SHOP_INSUFFICIENT_POINTS');
    if (!alreadyUnlocked) {
      previewUnlockedSkinIds.add(skinId);
      previewShopPoints -= 600;
    }
    return { skinId, unlockedAt: new Date().toISOString(), alreadyUnlocked, pricePoints: 600, totalPoints: previewShopPoints } satisfies ShopUnlockResponse;
  }
  return request<ShopUnlockResponse>('/shop/unlock', { method: 'POST', body: JSON.stringify({ skinId }) });
};

export const fetchMyWeeklySummary = (week: string) => {
  if (!ISO_WEEK_PATTERN.test(week)) return Promise.reject(new ApiError(400, '周格式应为 YYYY-Www，例如 2026-W36。'));
  if (isAdminPreviewSession()) return Promise.resolve({
    week,
    totalFocusedMinutes: 825,
    totalPoints: 795,
    rawFocusedMinutes: 795,
    adjustedMinutes: 30,
    adjustmentsCount: 1,
    checkedInDays: 5,
    days: [
      { date: '2026-08-31', focusedMinutes: 155, sessions: 2, points: 155 },
      { date: '2026-09-01', focusedMinutes: 168, sessions: 2, points: 168 },
      { date: '2026-09-02', focusedMinutes: 142, sessions: 1, points: 142 },
      { date: '2026-09-03', focusedMinutes: 170, sessions: 2, points: 170 },
      { date: '2026-09-04', focusedMinutes: 160, sessions: 2, points: 160 }
    ],
    adjustments: [{ operation: 'add', durationSeconds: 1800, reason: '管理员调整：补充活动时长', createdAt: '2026-09-02T09:30:00.000Z' }]
  } satisfies AttendanceWeeklySummary);
  return request<AttendanceWeeklySummary>(`/attendance/me/weekly-summary?week=${encodeURIComponent(week)}`);
};

export interface MyRecordsQuery {
  page?: number;
  pageSize?: number;
  weekKey?: string;
  startDate?: string;
  endDate?: string;
}

export const fetchMyRecords = (query: MyRecordsQuery = {}) => {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.weekKey) params.set('weekKey', query.weekKey);
  if (query.startDate) params.set('startDate', query.startDate);
  if (query.endDate) params.set('endDate', query.endDate);
  if (isAdminPreviewSession()) return Promise.resolve({
    items: [
      { id: 'preview-session-001', checkInAt: '2026-09-02T11:00:00.000Z', checkOutAt: '2026-09-02T13:35:00.000Z', durationSeconds: 9300, status: 'completed', invalidReason: null, isMarked: false, weekKey: query.weekKey || '2026-08-31' },
      { id: 'preview-session-002', checkInAt: '2026-09-01T05:20:00.000Z', checkOutAt: '2026-09-01T07:10:00.000Z', durationSeconds: 6600, status: 'completed', invalidReason: null, isMarked: true, weekKey: query.weekKey || '2026-08-31' }
    ],
    page: query.page || 1,
    pageSize: query.pageSize || 20
  } satisfies MyRecordsResponse);
  return request<MyRecordsResponse>(`/records/me${params.size ? `?${params.toString()}` : ''}`);
};

export const fetchMyWeeklyStats = () => isAdminPreviewSession()
  ? Promise.resolve({
    items: [
      { weekKey: '2026-08-31', totalDurationSeconds: 49500, recordedDurationSeconds: 47700, manualAdjustmentSeconds: 1800, adjustmentsCount: 1, sessionsCount: 9, weeklyGoalSeconds: 54000 },
      { weekKey: '2026-08-24', totalDurationSeconds: 45800, recordedDurationSeconds: 45800, manualAdjustmentSeconds: 0, adjustmentsCount: 0, sessionsCount: 8, weeklyGoalSeconds: 54000 }
    ],
    weeklyGoalSeconds: 54000
  } satisfies MyWeeklyStatsResponse)
  : request<MyWeeklyStatsResponse>('/stats/me/weekly');
export const fetchTeamWeeklyStats = () => isAdminPreviewSession()
  ? Promise.resolve({ items: previewMembers.filter((member) => member.status !== 'disabled').map((member, index) => ({ memberKey: member.id, displayName: member.displayName, realName: member.realName, enrollYear: member.enrollYear, role: member.role, avatarEmoji: member.avatarEmoji, avatarColor: member.avatarColor, totalDurationSeconds: (12 - index) * 3600 + (index + 2) * 780, sessionsCount: Math.max(2, 8 - index), weekKey: '2026-W36' })).sort((left, right) => right.totalDurationSeconds - left.totalDurationSeconds) })
  : request<TeamWeeklyStatsResponse>('/stats/team/current-week');
export const fetchTeamActiveAttendance = () => isAdminPreviewSession()
  ? Promise.resolve(previewAttendance.hasActiveSession && previewAttendance.session
    ? [{ memberKey: previewUser.id, displayName: previewUser.displayName, enrollYear: previewUser.enrollYear, avatarEmoji: previewUser.avatarEmoji, avatarColor: previewUser.avatarColor, checkInAt: previewAttendance.session.checkInAt, elapsedSeconds: previewAttendance.session.elapsedSeconds, weekKey: '2026-W36' } satisfies TeamActiveAttendance]
    : [])
  : request<{ items: TeamActiveAttendance[] }>('/attendance/team-active').then((result) => result.items);
export const checkIn = () => {
  if (isAdminPreviewSession()) {
    previewAttendance = { hasActiveSession: true, session: { checkInAt: new Date().toISOString(), elapsedSeconds: 0, creditedSeconds: 0 } };
    return Promise.resolve({});
  }
  return request('/attendance/check-in', { method: 'POST' });
};
export const checkOut = () => {
  if (isAdminPreviewSession()) {
    previewAttendance = { hasActiveSession: false, session: null };
    return Promise.resolve({});
  }
  return request('/attendance/check-out', { method: 'POST' });
};

export const fetchAdminMembers = async () => {
  if (isAdminPreviewSession()) return clone(previewMembers);
  const result = await request<{ items: ElectionUser[] }>('/users/admin/members');
  return result.items;
};
export const updateAdminMember = async (userId: string, input: Partial<Pick<ElectionUser, 'role' | 'status'>>) => {
  if (isAdminPreviewSession()) {
    const current = previewMembers.find((member) => member.id === userId);
    if (!current) throw new Error('未找到演示成员。');
    const updated = { ...current, ...input };
    previewMembers = previewMembers.map((member) => member.id === userId ? updated : member);
    if (userId === previewUser.id) previewUser = updated;
    return clone(updated);
  }
  return request<ElectionUser>(`/users/admin/members/${userId}`, { method: 'PATCH', body: JSON.stringify(input) });
};
export const deleteAdminMember = async (userId: string) => {
  if (isAdminPreviewSession()) {
    if (userId === previewUser.id) throw new ApiError(403, '不能删除当前管理员。');
    previewMembers = previewMembers.filter((member) => member.id !== userId);
    return { success: true };
  }
  return request<{ success: true }>(`/users/admin/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
};
export const fetchAdminNetworkPolicy = () => isAdminPreviewSession()
  ? Promise.resolve(clone(previewPolicy))
  : request<AdminNetworkPolicy>('/network-policy/admin/current');
export const updateAdminNetworkPolicy = async (input: Pick<AdminNetworkPolicy, 'allowAnyNetwork' | 'allowedPublicIps' | 'allowedCidrs' | 'trustProxy' | 'trustedProxyHops'>) => {
  if (isAdminPreviewSession()) {
    previewPolicy = { ...previewPolicy, ...input, updatedAt: new Date().toISOString() };
    return clone(previewPolicy);
  }
  return request<AdminNetworkPolicy>('/network-policy/admin/current', { method: 'PATCH', body: JSON.stringify(input) });
};
export const fetchNetworkPolicyStatus = (adminDebug = false) => isAdminPreviewSession()
  ? Promise.resolve({ clientIp: '203.0.113.16', isAllowed: true } satisfies NetworkPolicyStatus)
  : request<NetworkPolicyStatus>(adminDebug ? '/network-policy/admin/debug' : '/network-policy/current-status');

const queryString = (query: object) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if ((typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') && value !== '') params.set(key, String(value)); });
  return params.size ? `?${params.toString()}` : '';
};

export interface GitHubSourceInput {
  repoUrl: string;
  siteUrl?: string | null;
  branch?: string;
  indexPath?: string;
  accessMode?: 'public';
  enabled?: boolean;
}
export const fetchGitHubSource = () => isAdminPreviewSession()
  ? Promise.resolve({ item: { userId: previewUser.id, repoUrl: 'https://github.com/local-preview/daily-log', siteUrl: 'https://example.com/blog/lin-yuan', branch: 'main', indexPath: 'public/blogs/index.json', accessMode: 'public', enabled: true, verifiedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' } satisfies GitHubSourceItem })
  : request<{ item: GitHubSourceItem | null }>('/github-source/me');
export const saveGitHubSource = (input: GitHubSourceInput) => isAdminPreviewSession()
  ? Promise.resolve({ item: { userId: previewUser.id, repoUrl: input.repoUrl, siteUrl: input.siteUrl?.trim() || null, branch: input.branch || 'main', indexPath: input.indexPath || 'public/blogs/index.json', accessMode: 'public', enabled: input.enabled ?? true, verifiedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: new Date().toISOString() } satisfies GitHubSourceItem })
  : request<{ item: GitHubSourceItem }>('/github-source/me', { method: 'PUT', body: JSON.stringify(input) });
export const deleteGitHubSource = () => isAdminPreviewSession() ? Promise.resolve({ success: true }) : request<{ success: true }>('/github-source/me', { method: 'DELETE' });
export const fetchTeamGitHubSources = () => isAdminPreviewSession()
  ? Promise.resolve({ items: [
    { displayName: '林予安', repoUrl: 'https://github.com/local-preview/daily-log', siteUrl: 'https://example.com/blog/lin-yuan' },
    { displayName: '晨曦', repoUrl: 'https://github.com/preview-team/chenxi-notes', siteUrl: 'https://example.com/blog/chenxi' },
    { displayName: '墨宇', repoUrl: 'https://github.com/preview-team/moyu-notes', siteUrl: null }
  ] } satisfies TeamGitHubSourcesResponse)
  : request<TeamGitHubSourcesResponse>('/github-sources/team');

export interface WeeklyReportReferenceInput {
  status: WeeklyReportReference['status'];
  githubPath?: string;
  rawUrl?: string;
  commitSha?: string;
  dailyLogCount?: number;
}
export const fetchMyWeeklyReport = (week: string) => isAdminPreviewSession()
  ? fetchMyWeeklySummary(week).then((attendanceSummary) => ({ week, item: null, attendanceSummary } satisfies MyWeeklyReportResponse))
  : request<MyWeeklyReportResponse>(`/weekly-reports/me?week=${encodeURIComponent(week)}`);
export const saveMyWeeklyReport = (week: string, input: WeeklyReportReferenceInput) => isAdminPreviewSession()
  ? Promise.resolve({ week, item: { githubPath: input.githubPath || null, rawUrl: input.rawUrl || null, commitSha: input.commitSha || null, dailyLogCount: input.dailyLogCount || 0, status: input.status, generatedAt: input.status === 'generated' ? new Date().toISOString() : null, updatedAt: new Date().toISOString() } satisfies WeeklyReportReference })
  : request<{ week: string; item: WeeklyReportReference }>(`/weekly-reports/me?week=${encodeURIComponent(week)}`, { method: 'PUT', body: JSON.stringify(input) });
export const fetchAdminWeeklyReports = (week: string) => isAdminPreviewSession()
  ? Promise.resolve({ week, items: previewMembers.map((member) => ({ member: { userId: member.id, username: member.username, displayName: member.displayName, role: member.role, status: member.status || 'active' }, githubPath: null, rawUrl: null, commitSha: null, dailyLogCount: 0, status: 'missing', generatedAt: null, updatedAt: null, attendanceAdjustment: { manualAdjustmentSeconds: 0, adjustmentsCount: 0, items: [] } })) } as AdminWeeklyReportsResponse)
  : request<AdminWeeklyReportsResponse>(`/weekly-reports/admin?week=${encodeURIComponent(week)}`);

export interface EligibilityInput { studentId: string; realName: string; status?: 'allowed' | 'blocked'; note?: string; }
export const fetchEligibilityEntries = (query: { keyword?: string; status?: 'allowed' | 'blocked'; limit?: number } = {}) => isAdminPreviewSession()
  ? Promise.resolve({ items: [{ id: 'preview-eligibility-001', teamId: previewUser.teamId, studentId: '202501010028', realName: '陈曦', status: 'allowed', note: '演示白名单', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }] satisfies MemberEligibilityEntry[] })
  : request<{ items: MemberEligibilityEntry[] }>(`/member-eligibility/admin/entries${queryString(query)}`);
export const createEligibilityEntry = (input: EligibilityInput) => isAdminPreviewSession()
  ? Promise.resolve({ id: `preview-eligibility-${Date.now()}`, teamId: previewUser.teamId, ...input, status: input.status || 'allowed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } satisfies MemberEligibilityEntry)
  : request<MemberEligibilityEntry>('/member-eligibility/admin/entries', { method: 'POST', body: JSON.stringify(input) });
export const updateEligibilityEntry = (entryId: string, input: Partial<EligibilityInput>) => isAdminPreviewSession()
  ? Promise.resolve({ id: entryId, teamId: previewUser.teamId, studentId: input.studentId || '202501010028', realName: input.realName || '陈曦', status: input.status || 'allowed', note: input.note, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: new Date().toISOString() } satisfies MemberEligibilityEntry)
  : request<MemberEligibilityEntry>(`/member-eligibility/admin/entries/${encodeURIComponent(entryId)}`, { method: 'PATCH', body: JSON.stringify(input) });
export const deleteEligibilityEntry = (entryId: string) => isAdminPreviewSession() ? Promise.resolve({ success: true }) : request<{ success: true }>(`/member-eligibility/admin/entries/${encodeURIComponent(entryId)}`, { method: 'DELETE' });

export interface TeamLedgerEntryInput { occurredAt: string; type: 'income' | 'expense'; amountCents: number; category: string; counterparty?: string; note?: string; proofFileName?: string; proofFileMimeType?: string; proofFileBase64?: string; }
export interface LedgerFilter { from?: string; to?: string; type?: 'income' | 'expense'; status?: 'active' | 'voided' | 'all'; category?: string; limit?: number; }
export const fetchLedgerEntries = (filter: LedgerFilter = {}) => isAdminPreviewSession()
  ? Promise.resolve({ items: [{ id: 'preview-ledger-001', teamId: previewUser.teamId, occurredAt: '2026-09-02T00:00:00.000Z', type: 'income', status: 'active', amountCents: 5000, category: '活动经费', counterparty: '演示赞助', note: '本地预览账目', createdBy: previewUser.id, createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' }] satisfies TeamLedgerEntry[] })
  : request<{ items: TeamLedgerEntry[] }>(`/team-ledger/admin/entries${queryString(filter)}`);
export const createLedgerEntry = (input: TeamLedgerEntryInput) => isAdminPreviewSession()
  ? Promise.resolve({ id: `preview-ledger-${Date.now()}`, teamId: previewUser.teamId, status: 'active', createdBy: previewUser.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...input } satisfies TeamLedgerEntry)
  : request<TeamLedgerEntry>('/team-ledger/admin/entries', { method: 'POST', body: JSON.stringify(input) });
export const voidLedgerEntry = (entryId: string, reason?: string) => isAdminPreviewSession()
  ? Promise.resolve({ id: entryId, teamId: previewUser.teamId, occurredAt: new Date().toISOString(), type: 'income', status: 'voided', amountCents: 0, category: '演示', createdBy: previewUser.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), voidReason: reason } satisfies TeamLedgerEntry)
  : request<TeamLedgerEntry>(`/team-ledger/admin/entries/${encodeURIComponent(entryId)}/void`, { method: 'PATCH', body: JSON.stringify({ reason }) });
export const reverseLedgerEntry = (entryId: string, input: { occurredAt?: string; note?: string }) => isAdminPreviewSession()
  ? Promise.resolve({ id: `preview-reversal-${Date.now()}`, teamId: previewUser.teamId, occurredAt: input.occurredAt || new Date().toISOString(), type: 'expense', status: 'active', amountCents: 0, category: '演示', reversalOfEntryId: entryId, createdBy: previewUser.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), note: input.note } satisfies TeamLedgerEntry)
  : request<TeamLedgerEntry>(`/team-ledger/admin/entries/${encodeURIComponent(entryId)}/reversal`, { method: 'POST', body: JSON.stringify(input) });
export const fetchLedgerSummary = (filter: Pick<LedgerFilter, 'from' | 'to' | 'status'> = {}) => isAdminPreviewSession()
  ? Promise.resolve({ incomeCents: 5000, expenseCents: 1800, netCents: 3200, entryCount: 2 } satisfies TeamLedgerSummary)
  : request<TeamLedgerSummary>(`/team-ledger/admin/summary${queryString(filter)}`);
export const fetchLedgerTrend = (filter: Pick<LedgerFilter, 'from' | 'to' | 'status'> & { granularity?: 'day' | 'week' } = {}) => isAdminPreviewSession()
  ? Promise.resolve({ items: [{ bucketKey: '2026-09-02', incomeCents: 5000, expenseCents: 1800, netCents: 3200, entryCount: 2 }] satisfies TeamLedgerTrendItem[] })
  : request<{ items: TeamLedgerTrendItem[] }>(`/team-ledger/admin/trend${queryString(filter)}`);
export const downloadLedgerExport = (filter: LedgerFilter = {}) => isAdminPreviewSession()
  ? Promise.reject(new ApiError(501, '本地预览不生成导出文件。'))
  : requestDownload(`/team-ledger/admin/export${queryString(filter)}`);

export interface TeamEventInput { title: string; description?: string; eventAt: string; status?: 'planned' | 'done' | 'cancelled'; }
export const fetchTeamEvents = (admin = false, query: { status?: TeamEventItem['status']; from?: string; to?: string; limit?: number } = {}) => isAdminPreviewSession()
  ? Promise.resolve({ items: [{ id: 'preview-event-001', teamId: previewUser.teamId, title: '本周复盘会', description: '演示团队事务', eventAt: '2026-09-05T12:00:00.000Z', status: 'planned', createdBy: previewUser.id, updatedBy: previewUser.id, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }] satisfies TeamEventItem[] })
  : request<{ items: TeamEventItem[] }>(`/team-events/${admin ? 'admin/' : ''}events${queryString(query)}`);
export const createTeamEvent = (input: TeamEventInput) => isAdminPreviewSession()
  ? Promise.resolve({ id: `preview-event-${Date.now()}`, teamId: previewUser.teamId, description: '', status: 'planned', createdBy: previewUser.id, updatedBy: previewUser.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...input } satisfies TeamEventItem)
  : request<TeamEventItem>('/team-events/admin/events', { method: 'POST', body: JSON.stringify(input) });
export const updateTeamEvent = (eventId: string, input: Partial<TeamEventInput>) => isAdminPreviewSession()
  ? Promise.resolve({ id: eventId, teamId: previewUser.teamId, title: input.title || '本周复盘会', description: input.description, eventAt: input.eventAt || new Date().toISOString(), status: input.status || 'planned', createdBy: previewUser.id, updatedBy: previewUser.id, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: new Date().toISOString() } satisfies TeamEventItem)
  : request<TeamEventItem>(`/team-events/admin/events/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: JSON.stringify(input) });

export const adjustCurrentWeekDuration = (input: { username: string; operation: 'add' | 'subtract'; durationSeconds: number; reason?: string }) => isAdminPreviewSession()
  ? Promise.resolve({ success: true })
  : request('/attendance/admin/current-week-duration-adjustments', { method: 'POST', body: JSON.stringify(input) });
export const fetchAdminWeeklyAdjustments = (week: string) => isAdminPreviewSession()
  ? Promise.resolve({ week, items: [] as AdminDurationAdjustment[] })
  : request<{ week: string; items: AdminDurationAdjustment[] }>(`/attendance/admin/weekly-adjustments?week=${encodeURIComponent(week)}`);

export const fetchMemberWeeklyStats = (memberKey: string) => isAdminPreviewSession()
  ? Promise.resolve({ member: { memberKey, displayName: previewMembers.find((member) => member.id === memberKey)?.displayName || '演示成员', role: 'member' }, items: [{ weekKey: '2026-08-31', totalDurationSeconds: 49500, recordedDurationSeconds: 47700, manualAdjustmentSeconds: 1800, adjustmentsCount: 1, sessionsCount: 9, weeklyGoalSeconds: 54000 }] } satisfies MemberWeeklyStatsResponse)
  : request<MemberWeeklyStatsResponse>(`/stats/member/${encodeURIComponent(memberKey)}/weekly`);
export const fetchMemberRecords = (memberKey: string, query: MyRecordsQuery = {}) => isAdminPreviewSession()
  ? Promise.resolve({ items: [{ id: `preview-member-session-${memberKey}`, checkInAt: '2026-09-02T11:00:00.000Z', checkOutAt: '2026-09-02T13:35:00.000Z', durationSeconds: 9300, status: 'completed', invalidReason: null, isMarked: false, weekKey: '2026-08-31' }], page: query.page || 1, pageSize: query.pageSize || 20 } satisfies MyRecordsResponse)
  : request<MyRecordsResponse>(`/records/member/${encodeURIComponent(memberKey)}${queryString(query)}`);
export const markAdminRecord = (recordId: string, isMarked: boolean) => isAdminPreviewSession() ? Promise.resolve({ id: recordId, isMarked }) : request(`/records/admin/${encodeURIComponent(recordId)}/mark`, { method: 'PATCH', body: JSON.stringify({ isMarked }) });
export const deleteAdminRecord = (recordId: string) => isAdminPreviewSession() ? Promise.resolve({ success: true }) : request<{ success: true }>(`/records/admin/${encodeURIComponent(recordId)}`, { method: 'DELETE' });
export const downloadRecordsExport = (query: Pick<MyRecordsQuery, 'weekKey' | 'startDate' | 'endDate'> = {}) => requestDownload(`/records/admin/export${queryString(query)}`);

export const submitReport = async (description: string, images: File[]) => {
  if (isAdminPreviewSession()) {
    const createdAt = new Date().toISOString();
    const report: ReportItem = {
      id: `preview-report-${Date.now()}`,
      teamId: previewUser.teamId,
      reporter: { userId: previewUser.id, username: previewUser.username, displayName: previewUser.displayName },
      description: description.trim(),
      images: images.map((image, index) => ({ id: `preview-image-${Date.now()}-${index}`, contentType: image.type as ReportItem['images'][number]['contentType'], sizeBytes: image.size, downloadPath: '' })),
      imagesExpireAt: images.length ? new Date(Date.now() + 3 * 60 * 60 * 1_000).toISOString() : null,
      imagesPurgedAt: null,
      createdAt
    };
    previewReports = [report, ...previewReports];
    previewNotifications = [{
      id: `preview-notification-${Date.now()}`,
      teamId: previewUser.teamId,
      userId: previewUser.id,
      type: 'report.submitted',
      title: '收到新的请假申请',
      message: `${previewUser.displayName} 提交了一条请假申请，请及时查看。`,
      payload: { reportId: report.id, reporterDisplayName: previewUser.displayName, imageCount: images.length, imagesExpireAt: report.imagesExpireAt },
      sourceType: 'report',
      sourceId: report.id,
      createdBy: previewUser.id,
      createdAt,
      acknowledgedAt: null
    }, ...previewNotifications];
    return clone(report);
  }
  const form = new FormData();
  form.append('description', description.trim());
  images.forEach((image) => form.append('images', image));
  return request<ReportItem>('/reports', { method: 'POST', body: form });
};

export const fetchAdminReports = (page = 1, pageSize = 20) => isAdminPreviewSession()
  ? Promise.resolve({ items: clone(previewReports), page, pageSize, total: previewReports.length } satisfies AdminReportsResponse)
  : request<AdminReportsResponse>(`/reports/admin?page=${page}&pageSize=${pageSize}`);

export const fetchReportImage = (reportId: string, imageId: string) => {
  if (isAdminPreviewSession()) return Promise.reject(new ApiError(404, '图片已过期或不存在。'));
  return requestBlob(`/reports/admin/${encodeURIComponent(reportId)}/images/${encodeURIComponent(imageId)}`);
};

export const fetchNotifications = (status: 'unacked' | 'all' = 'unacked', limit = 20) => isAdminPreviewSession()
  ? Promise.resolve({ items: clone(previewNotifications.filter((item) => status === 'all' || !item.acknowledgedAt).slice(0, limit)) })
  : request<{ items: ElectionNotification[] }>(`/notifications/me?status=${status}&limit=${limit}`);

export const acknowledgeNotification = async (notificationId: string) => {
  if (isAdminPreviewSession()) {
    previewNotifications = previewNotifications.map((item) => item.id === notificationId && !item.acknowledgedAt ? { ...item, acknowledgedAt: new Date().toISOString() } : item);
    const item = previewNotifications.find((candidate) => candidate.id === notificationId);
    if (!item) throw new ApiError(404, '通知不存在。');
    return clone(item);
  }
  return request<ElectionNotification>(`/notifications/${encodeURIComponent(notificationId)}/ack`, { method: 'PATCH' });
};

export interface NotificationStreamCallbacks {
  onNotification: (notification: ElectionNotification) => void;
  onReconnect: () => Promise<void> | void;
  onError?: (error: ApiError) => void;
}

const parseSseBlock = (block: string) => {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join('\n')) as unknown };
  } catch {
    return null;
  }
};

/** Uses fetch rather than EventSource so the established Bearer header is preserved. */
export const startNotificationStream = (callbacks: NotificationStreamCallbacks) => {
  if (isAdminPreviewSession()) return () => undefined;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let reconnectDelayMs = 1_000;
  let connectedOnce = false;

  const scheduleReconnect = () => {
    if (stopped) return;
    const delay = reconnectDelayMs;
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30_000);
    reconnectTimer = setTimeout(() => void connect(), delay);
  };

  const connect = async () => {
    if (stopped) return;
    const connectionController = new AbortController();
    controller = connectionController;
    let idleAbort = false;
    let idleTimer: ReturnType<typeof setInterval> | undefined;
    try {
      const response = await requestResponse('/notifications/stream', {
        headers: { Accept: 'text/event-stream' },
        signal: connectionController.signal
      });
      if (connectedOnce) {
        try {
          await callbacks.onReconnect();
        } catch {
          // The stream itself is healthy; an unread backfill failure must not be
          // misclassified as a transport failure or trigger an avoidable loop.
          callbacks.onError?.(new ApiError(0, '通知连接已恢复，但未读通知同步失败。'));
        }
      }
      connectedOnce = true;
      reconnectDelayMs = 1_000;
      if (!response.body) throw new ApiError(0, '通知流未返回可读取的数据。');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastActivityAt = Date.now();
      // Server sends heartbeat every 30 seconds. A 90-second silence usually
      // means a dead TCP path that fetch() will otherwise retain for nginx's
      // much longer timeout; abort so normal exponential reconnect can recover.
      idleTimer = setInterval(() => {
        if (!stopped && Date.now() - lastActivityAt > 90_000) {
          idleAbort = true;
          connectionController.abort();
        }
      }, 15_000);
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        lastActivityAt = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split(/\r?\n\r?\n/);
        buffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const parsed = parseSseBlock(chunk);
          if (parsed?.event === 'notification.created') callbacks.onNotification(parsed.data as ElectionNotification);
        }
      }
      if (!stopped) scheduleReconnect();
    } catch (error) {
      if (stopped) return;
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (idleAbort) scheduleReconnect();
        return;
      }
      const apiError = error instanceof ApiError ? error : new ApiError(0, '通知连接已断开，将自动重试。');
      callbacks.onError?.(apiError);
      if (apiError.status === 401 || apiError.status === 403) return;
      scheduleReconnect();
    } finally {
      if (idleTimer) clearInterval(idleTimer);
    }
  };

  void connect();
  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    controller?.abort();
  };
};
