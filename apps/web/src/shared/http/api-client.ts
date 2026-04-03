import axios, { AxiosHeaders } from 'axios';
import { useRootStore } from '@/app/store/root-store';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'api';

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 10000
});

console.log(apiBaseUrl)

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('lecpunch.token');
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
      localStorage.removeItem('lecpunch.token');
      localStorage.removeItem('lecpunch.user');
      useRootStore.getState().setAuth({ token: null, user: null });
    }
    return Promise.reject(error);
  }
);

export { apiClient };
