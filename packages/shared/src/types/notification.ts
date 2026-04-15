export type NotificationType = 'attendance.record_marked';
export type NotificationSourceType = 'attendance_record';

export interface AttendanceRecordMarkedNotificationPayload {
  recordId: string;
  memberKey: string;
  weekKey: string;
}

export interface NotificationPayloadMap {
  'attendance.record_marked': AttendanceRecordMarkedNotificationPayload;
}

export type NotificationPayload<T extends NotificationType = NotificationType> = NotificationPayloadMap[T];

export interface NotificationItem<T extends NotificationType = NotificationType> {
  id: string;
  teamId: string;
  userId: string;
  type: T;
  title: string;
  message: string;
  payload: NotificationPayloadMap[T];
  sourceType: NotificationSourceType;
  sourceId: string;
  createdBy: string;
  createdAt: string;
  acknowledgedAt: string | null;
}
