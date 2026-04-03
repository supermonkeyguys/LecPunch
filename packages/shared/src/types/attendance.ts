export type AttendanceStatus = 'active' | 'completed' | 'invalidated';
export type AttendanceInvalidReason = 'overtime_5h';

export interface AttendanceSession {
  id: string;
  teamId: string;
  userId: string;
  checkInAt: string;
  checkOutAt?: string;
  durationSeconds?: number;
  status: AttendanceStatus;
  invalidReason?: AttendanceInvalidReason;
  weekKey: string;
  createdAt: string;
  updatedAt: string;
}
