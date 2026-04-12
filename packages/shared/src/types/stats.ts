export interface WeeklyStatItem {
  weekKey: string;
  totalDurationSeconds: number;
  sessionsCount: number;
}

export interface TeamWeeklyStatItem extends WeeklyStatItem {
  userId: string;
  displayName: string;
  role: 'member' | 'admin';
  enrollYear: number;
  avatarColor?: string;
  avatarEmoji?: string;
  avatarBase64?: string;
}
