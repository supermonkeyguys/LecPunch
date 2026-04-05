export type UserRole = 'member' | 'admin';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string;
  teamId: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  enrollYear: number;
  createdAt: string;
  updatedAt: string;
  studentId?: string;
  realName?: string;
  avatarBase64?: string;
  avatarColor?: string;
  avatarEmoji?: string;
}

