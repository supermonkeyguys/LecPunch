import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useRootStore } from '@/app/store/root-store';

export const AdminRoute = () => {
  const location = useLocation();
  const auth = useRootStore((state) => state.auth);

  if (!auth.token || !auth.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (auth.user.role !== 'admin') {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};
