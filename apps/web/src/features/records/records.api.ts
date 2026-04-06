import { apiClient } from '@/shared/http/api-client';
import type { AttendanceSession } from '@lecpunch/shared';

export interface RecordFilters {
  weekKey?: string;
  startDate?: string;
  endDate?: string;
}

export const getMyRecords = async (filters?: RecordFilters) => {
  const response = await apiClient.get<{ items: AttendanceSession[]; page: number; pageSize: number }>('/records/me', {
    params: filters ?? undefined
  });
  return response.data.items;
};

export const getMemberRecords = async (userId: string, filters?: RecordFilters) => {
  const response = await apiClient.get<{ items: AttendanceSession[]; page: number; pageSize: number }>(`/records/member/${userId}`, {
    params: filters ?? undefined
  });
  return response.data.items;
};
