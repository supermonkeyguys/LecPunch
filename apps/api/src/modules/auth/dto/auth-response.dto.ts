import { UserRole, UserStatus } from '@lecpunch/shared';

export interface AuthUserResponse {
  id: string;
  username: string;
  displayName: string;
  teamId: string;
  role: UserRole;
  status: UserStatus;
  enrollYear: number;
  studentId?: string;
  realName?: string;
  avatarBase64?: string;
  avatarColor?: string;
  avatarEmoji?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUserResponse;
}
