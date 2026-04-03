import { apiClient } from '@/shared/http/api-client';

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

export const checkInAttendance = async () => {
  const response = await apiClient.post('/attendance/check-in');
  return response.data;
};

export const checkOutAttendance = async () => {
  const response = await apiClient.post('/attendance/check-out');
  return response.data;
};
