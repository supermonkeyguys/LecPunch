export interface WeeklyStatItem {
  weekKey: string;
  totalDurationSeconds: number;
  sessionsCount: number;
  weeklyGoalSeconds: number;
}

export interface TeamWeeklyStatItem extends WeeklyStatItem {
  displayName: string;
  role: 'member' | 'admin';
  enrollYear: number;
  avatarColor?: string;
  avatarEmoji?: string;
  avatarBase64?: string;
}
