import { apiClient } from '@/shared/http/api-client';

import type { TeamActiveAttendanceItem } from '@lecpunch/shared';

export interface CurrentAttendanceResponse {
  hasActiveSession: boolean;
  session: null | {
    id: string;
    checkInAt: string;
    elapsedSeconds: number;
    status?: string;
    durationSeconds?: number;
    weekKey?: string;
  };
}

export const getCurrentAttendance = async () => {
  const response = await apiClient.get<CurrentAttendanceResponse>('/attendance/current');
  return response.data;
};

export const getTeamActiveAttendances = async () => {
  const response = await apiClient.get<{ items: TeamActiveAttendanceItem[] }>('/attendance/team-active');
  return response.data.items;
};

export const checkInAttendance = async () => {
  const response = await apiClient.post('/attendance/check-in');
  return response.data;
};

export interface CheckOutResponse {
  status: 'completed' | 'invalidated';
  invalidReason?: string;
}

export const checkOutAttendance = async (): Promise<CheckOutResponse> => {
  const response = await apiClient.post<CheckOutResponse>('/attendance/check-out');
  return response.data;
};
