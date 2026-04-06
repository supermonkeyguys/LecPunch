import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRootStore } from '../store/root-store';
import { setNavigateToLogin } from '@/shared/http/api-client';

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  const setAuth = useRootStore((state) => state.setAuth);
  const navigate = useNavigate();

  useEffect(() => {
    setNavigateToLogin(() => navigate('/login', { replace: true }));
  }, [navigate]);

  // Auth is already restored synchronously in root-store.ts
  // This effect only handles cleanup if localStorage data is corrupt
  useEffect(() => {
    const token = localStorage.getItem('lecpunch.token');
    const rawUser = localStorage.getItem('lecpunch.user');
    if (token && !rawUser) {
      localStorage.removeItem('lecpunch.token');
      setAuth({ token: null, user: null });
    }
  }, [setAuth]);

  return children;
};
