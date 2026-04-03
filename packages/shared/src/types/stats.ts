export interface WeeklyStatItem {
  weekKey: string;
  totalDurationSeconds: number;
  sessionsCount: number;
}

export interface TeamWeeklyStatItem extends WeeklyStatItem {
  userId: string;
  displayName: string;
  role: 'member' | 'admin';
}
