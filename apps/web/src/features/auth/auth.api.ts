import { apiClient } from '@/shared/http/api-client';
import type { User } from '@lecpunch/shared';

interface AuthPayload {
  accessToken: string;
  user: User;
}

interface LoginInput {
  username: string;
  password: string;
  displayName?: string;
  studentId?: string;
  realName?: string;
  mode?: 'login' | 'register';
}

export const login = async ({ username, password, displayName, studentId, realName, mode = 'login' }: LoginInput) => {
  if (mode === 'register') {
    console.log('auth.api register payload:', { username, password, displayName, studentId, realName });
    const response = await apiClient.post<AuthPayload>('/auth/register', {
      username,
      password,
      displayName: (displayName?.trim() || username).trim(),
      studentId,
      realName,
    });
    return response.data;
  }

  const response = await apiClient.post<AuthPayload>('/auth/login', {
    username,
    password
  });
  return response.data;
};

export const fetchCurrentUser = async () => {
  const response = await apiClient.get<User>('/auth/me');
  return response.data;
};
