export type AttendanceStatus = 'active' | 'completed' | 'invalidated';
export type AttendanceInvalidReason = 'overtime_5h' | 'heartbeat_timeout';

export interface AttendanceSession {
  id: string;
  teamId: string;
  userId: string;
  checkInAt: string;
  checkOutAt?: string;
  lastKeepaliveAt?: string;
  durationSeconds?: number;
  status: AttendanceStatus;
  invalidReason?: AttendanceInvalidReason;
  isMarked: boolean;
  weekKey: string;
  weeklyGoalSecondsSnapshot?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamActiveAttendanceItem {
  memberKey: string;
  displayName: string;
  enrollYear: number;
  avatarColor?: string;
  avatarEmoji?: string;
  avatarBase64?: string;
  checkInAt: string;
  elapsedSeconds: number;
  weekKey: string;
}
