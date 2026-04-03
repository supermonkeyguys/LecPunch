import { apiClient } from '@/shared/http/api-client';
import type { AttendanceSession } from '@lecpunch/shared';

export const getMyRecords = async (weekKey?: string) => {
  const response = await apiClient.get<AttendanceSession[]>('/records/me', {
    params: weekKey ? { weekKey } : undefined
  });
  return response.data;
};

export const getMemberRecords = async (userId: string, weekKey?: string) => {
  const response = await apiClient.get<AttendanceSession[]>(`/records/member/${userId}`, {
    params: weekKey ? { weekKey } : undefined
  });
  return response.data;
};
