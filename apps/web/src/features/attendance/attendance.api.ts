import { apiClient } from '@/shared/http/api-client';

import type { AttendancePauseReason, TeamActiveAttendanceItem } from '@lecpunch/shared';

export interface CurrentAttendanceResponse {
  hasActiveSession: boolean;
  session: null | {
    id: string;
    checkInAt: string;
    elapsedSeconds: number;
    lastKeepaliveAt?: string;
    lastCreditedAt?: string;
    creditedSeconds?: number;
    pausedAt?: string;
    pauseReason?: AttendancePauseReason;
    isPaused?: boolean;
    segmentsCount?: number;
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

export const keepAliveAttendance = async () => {
  const response = await apiClient.post('/attendance/keepalive');
  return response.data;
};

export interface CheckOutResponse {
  status: 'completed' | 'invalidated';
  invalidReason?: string;
  durationSeconds?: number;
}

export const checkOutAttendance = async (): Promise<CheckOutResponse> => {
  const response = await apiClient.post<CheckOutResponse>('/attendance/check-out');
  return response.data;
};
