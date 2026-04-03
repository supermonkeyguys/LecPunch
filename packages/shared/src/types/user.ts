export type UserRole = 'member' | 'admin';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string;
  teamId: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}
