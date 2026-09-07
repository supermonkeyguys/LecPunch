export interface WeeklyStatItem {
  weekKey: string;
  /** Effective duration shown to members: recorded attendance plus approved manual adjustments. */
  totalDurationSeconds: number;
  /** Immutable wall-clock attendance duration, before any administrator adjustment. */
  recordedDurationSeconds: number;
  /** Signed administrator adjustment applied to the displayed duration. */
  manualAdjustmentSeconds: number;
  /** Number of administrator adjustment records included in this week. */
  adjustmentsCount: number;
  sessionsCount: number;
  weeklyGoalSeconds: number;
}

export interface TeamWeeklyStatItem extends WeeklyStatItem {
  memberKey: string;
  displayName: string;
  realName?: string;
  role: 'member' | 'admin';
  enrollYear: number;
  avatarColor?: string;
  avatarEmoji?: string;
  avatarBase64?: string;
}
