import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/app/store/auth-store';

export const AdminRoute = () => {
  const location = useLocation();
  const auth = useAuthStore((state) => state.auth);

  if (!auth.token || !auth.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (auth.user.role !== 'admin') {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};
