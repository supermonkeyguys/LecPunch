import { UserRole, UserStatus } from '@lecpunch/shared';

export interface AuthUserResponse {
  id: string;
  username: string;
  displayName: string;
  teamId: string;
  role: UserRole;
  status: UserStatus;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUserResponse;
}
