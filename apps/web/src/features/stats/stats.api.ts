import { apiClient } from '@/shared/http/api-client';
import type { TeamWeeklyStatItem, WeeklyStatItem } from '@lecpunch/shared';

export interface MyWeeklyStatsResponse {
  items: WeeklyStatItem[];
  weeklyGoalSeconds: number;
}

export const getMyWeeklyStats = async (): Promise<MyWeeklyStatsResponse> => {
  const response = await apiClient.get<MyWeeklyStatsResponse>('/stats/me/weekly');
  return response.data;
};

export const getTeamCurrentWeekStats = async (sameGrade = false) => {
  const response = await apiClient.get<{ items: TeamWeeklyStatItem[] }>('/stats/team/current-week', {
    params: sameGrade ? { sameGrade: 'true' } : undefined
  });
  return response.data.items;
};

export interface MemberWeeklyStatsResponse {
  member: { id: string; displayName: string; role: string };
  items: WeeklyStatItem[];
}

export const getMemberWeeklyStats = async (userId: string): Promise<MemberWeeklyStatsResponse> => {
  const response = await apiClient.get<MemberWeeklyStatsResponse>(`/stats/member/${userId}/weekly`);
  return response.data;
};
