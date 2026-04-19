import axios, { AxiosHeaders } from 'axios';
import { useAuthStore } from '@/app/store/auth-store';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 10000
});

// Injected by AppProviders so the interceptor can navigate without React Router context
let _navigateToLogin: (() => void) | null = null;
export const setNavigateToLogin = (fn: () => void) => {
  _navigateToLogin = fn;
};

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().auth.token;
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().setAuth({ token: null, user: null });
      _navigateToLogin?.();
    }
    return Promise.reject(error);
  }
);
