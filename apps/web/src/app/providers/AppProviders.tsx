import { ReactNode, useEffect } from 'react';
import { useRootStore } from '../store/root-store';

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  const setAuth = useRootStore((state) => state.setAuth);

  useEffect(() => {
    const token = localStorage.getItem('lecpunch.token');
    const rawUser = localStorage.getItem('lecpunch.user');

    if (!token || !rawUser) {
      return;
    }

    try {
      setAuth({ token, user: JSON.parse(rawUser) });
    } catch {
      localStorage.removeItem('lecpunch.token');
      localStorage.removeItem('lecpunch.user');
      setAuth({ token: null, user: null });
    }
  }, [setAuth]);

  return children;
};
