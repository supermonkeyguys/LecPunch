export interface ElectionUser {
  id: string;
  displayName: string;
  username: string;
  role: 'member' | 'admin';
  teamId: string;
  status?: 'active' | 'disabled';
  enrollYear?: number;
  studentId?: string;
  realName?: string;
  avatarBase64?: string;
  avatarColor?: string;
  avatarEmoji?: string;
}

export interface AttendanceSnapshot {
  hasActiveSession: boolean;
  session: null | {
    checkInAt: string;
    elapsedSeconds: number;
    creditedSeconds?: number;
    isPaused?: boolean;
  };
}

export interface WeeklyReportItem {
  studentId: string;
  displayName: string;
  status: 'generated' | 'missing' | 'pending';
  dailyCount: number;
  summary: string;
  url?: string;
}

export interface WeeklyReportFeed {
  weekKey: string;
  generatedAt?: string;
  members: WeeklyReportItem[];
}

export interface TeamWeeklyStat {
  memberKey: string;
  displayName: string;
  realName?: string;
  enrollYear?: number;
  role: 'member' | 'admin';
  avatarBase64?: string;
  avatarColor?: string;
  avatarEmoji?: string;
  totalDurationSeconds: number;
  recordedDurationSeconds?: number;
  manualAdjustmentSeconds?: number;
  adjustmentsCount?: number;
  sessionsCount: number;
  weekKey: string;
}

export interface TeamWeeklyStatsResponse {
  items: TeamWeeklyStat[];
}

export interface TeamActiveAttendance {
  memberKey: string;
  displayName: string;
  enrollYear?: number;
  avatarBase64?: string;
  avatarColor?: string;
  avatarEmoji?: string;
  checkInAt: string;
  elapsedSeconds: number;
  weekKey: string;
}

export interface AdminNetworkPolicy {
  teamId: string;
  source: 'database' | 'environment';
  allowAnyNetwork: boolean;
  allowedPublicIps: string[];
  allowedCidrs: string[];
  trustProxy: boolean;
  trustedProxyHops: number;
  updatedAt: string | null;
}

export interface ReportImageItem {
  id: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  downloadPath: string;
}

export interface ReportItem {
  id: string;
  teamId: string;
  reporter: {
    userId: string;
    username: string;
    displayName: string;
  };
  description: string;
  images: ReportImageItem[];
  imagesExpireAt: string | null;
  imagesPurgedAt: string | null;
  createdAt: string;
}

export interface AdminReportsResponse {
  items: ReportItem[];
  page: number;
  pageSize: number;
  total: number;
}

export type ElectionNotificationType = 'attendance.record_marked' | 'report.submitted';

export interface ElectionNotification {
  id: string;
  teamId: string;
  userId: string;
  type: ElectionNotificationType;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  sourceType: 'attendance_record' | 'report';
  sourceId: string;
  createdBy: string;
  createdAt: string;
  acknowledgedAt: string | null;
}

export interface PointsSummary {
  totalPoints: number;
  week: string;
  weekPoints: number;
  accrualRate: { focusedMinutes: number; points: number };
  calculatedAt: string;
}

export interface ShopUnlocksResponse {
  skinIds: string[];
}

export interface ShopUnlockResponse {
  skinId: string;
  unlockedAt: string;
  alreadyUnlocked: boolean;
  pricePoints: number;
  totalPoints: number;
}

export interface AttendanceDaySummary {
  date: string;
  focusedMinutes: number;
  sessions: number;
  points: number;
}

export interface AttendanceAdjustmentSummary {
  operation: 'add' | 'subtract';
  durationSeconds: number;
  reason: string;
  createdAt: string;
}

export interface AttendanceWeeklySummary {
  week: string;
  totalFocusedMinutes: number;
  totalPoints: number;
  rawFocusedMinutes: number;
  adjustedMinutes: number;
  adjustmentsCount: number;
  checkedInDays: number;
  days: AttendanceDaySummary[];
  adjustments: AttendanceAdjustmentSummary[];
}

export interface AttendanceRecord {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationSeconds: number;
  status: 'active' | 'completed' | 'invalidated';
  invalidReason: string | null;
  isMarked: boolean;
  weekKey: string;
}

export interface MyRecordsResponse {
  items: AttendanceRecord[];
  page: number;
  pageSize: number;
}

export interface PersonalWeeklyStat {
  weekKey: string;
  totalDurationSeconds: number;
  recordedDurationSeconds: number;
  manualAdjustmentSeconds: number;
  adjustmentsCount: number;
  sessionsCount: number;
  weeklyGoalSeconds: number;
}

export interface MyWeeklyStatsResponse {
  items: PersonalWeeklyStat[];
  weeklyGoalSeconds: number;
}

export interface MemberWeeklyStatsResponse {
  member: { memberKey: string; displayName: string; role: ElectionUser['role'] };
  items: PersonalWeeklyStat[];
}

export interface GitHubSourceItem {
  userId: string;
  repoUrl: string;
  /** Public, human-facing blog URL. It is optional because raw GitHub reading only needs repoUrl. */
  siteUrl: string | null;
  branch: string;
  indexPath: string;
  accessMode: 'public';
  enabled: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The deliberately minimal same-team blog wall contract. */
export interface TeamGitHubSourceItem {
  displayName: string;
  repoUrl: string;
  siteUrl: string | null;
}

export interface TeamGitHubSourcesResponse {
  items: TeamGitHubSourceItem[];
}

export interface WeeklyReportReference {
  githubPath: string | null;
  rawUrl: string | null;
  commitSha: string | null;
  dailyLogCount: number;
  status: 'generated' | 'missing' | 'pending';
  generatedAt: string | null;
  updatedAt: string | null;
}

export interface MyWeeklyReportResponse {
  week: string;
  item: WeeklyReportReference | null;
  attendanceSummary: AttendanceWeeklySummary;
}

export interface AdminWeeklyReportItem extends WeeklyReportReference {
  member: {
    userId: string;
    username: string;
    displayName: string;
    role: ElectionUser['role'];
    status: NonNullable<ElectionUser['status']>;
  };
  attendanceAdjustment: {
    manualAdjustmentSeconds: number;
    adjustmentsCount: number;
    items: AttendanceAdjustmentSummary[];
  };
}

export interface AdminWeeklyReportsResponse {
  week: string;
  items: AdminWeeklyReportItem[];
}

export interface NetworkPolicyStatus {
  clientIp: string;
  isAllowed: boolean;
}

export interface MemberEligibilityEntry {
  id: string;
  teamId: string;
  studentId: string;
  realName: string;
  status: 'allowed' | 'blocked';
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamLedgerEntry {
  id: string;
  teamId: string;
  occurredAt: string;
  type: 'income' | 'expense';
  status: 'active' | 'voided';
  amountCents: number;
  category: string;
  counterparty?: string;
  note?: string;
  proofFileName?: string;
  proofFileMimeType?: string;
  proofFileBase64?: string;
  reversalOfEntryId?: string;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamLedgerSummary {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  entryCount: number;
}

export interface TeamLedgerTrendItem extends TeamLedgerSummary {
  bucketKey: string;
}

export interface TeamEventItem {
  id: string;
  teamId: string;
  title: string;
  description?: string;
  eventAt: string;
  status: 'planned' | 'done' | 'cancelled';
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDurationAdjustment {
  adjustmentId: string;
  userId: string;
  username: string;
  displayName: string;
  operation: AttendanceAdjustmentSummary['operation'];
  durationSeconds: number;
  signedDurationSeconds: number;
  reason: string | null;
  createdAt: string;
}

export interface MeetTokenResponse {
  token: string;
  room: string;
  expiresAt: string;
  expiresInSeconds: number;
}
