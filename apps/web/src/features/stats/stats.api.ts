import { apiClient } from '@/shared/http/api-client';
import type { TeamWeeklyStatItem, WeeklyStatItem } from '@lecpunch/shared';

export const getMyWeeklyStats = async () => {
  const response = await apiClient.get<WeeklyStatItem[]>('/stats/me/weekly');
  return response.data;
};

export const getTeamCurrentWeekStats = async () => {
  const response = await apiClient.get<TeamWeeklyStatItem[]>('/stats/team/current-week');
  return response.data;
};

export const getMemberWeeklyStats = async (userId: string) => {
  const response = await apiClient.get<WeeklyStatItem[]>(`/stats/member/${userId}/weekly`);
  return response.data;
};
