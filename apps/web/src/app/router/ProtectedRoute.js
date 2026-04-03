import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useRootStore } from '@/app/store/root-store';
export const ProtectedRoute = () => {
    const location = useLocation();
    const auth = useRootStore((state) => state.auth);
    if (!auth.token || !auth.user) {
        return _jsx(Navigate, { to: "/login", replace: true, state: { from: location.pathname } });
    }
    return _jsx(Outlet, {});
};
