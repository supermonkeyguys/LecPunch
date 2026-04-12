import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import { AppProviders } from '../providers/AppProviders';
import { ToastContainer } from '@/shared/ui/toast';
import { AuthLayout } from '../layouts/AuthLayout';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';
import { LoginPage } from '@/pages/login/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { RecordsPage } from '@/pages/records/RecordsPage';
import { MembersPage } from '@/pages/members/MembersPage';
import { MemberRecordsPage } from '@/pages/member-records/MemberRecordsPage';
import { WeeklyHistoryPage } from '@/pages/weekly-history/WeeklyHistoryPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { AdminMembersPage } from '@/pages/admin-members/AdminMembersPage';
import { AdminNetworkPolicyPage } from '@/pages/admin-network-policy/AdminNetworkPolicyPage';
import { AdminRecordsExportPage } from '@/pages/admin-records-export/AdminRecordsExportPage';

// Root wrapper inside the router context — safe to use useNavigate here
const Root = () => (
  <AppProviders>
    <Outlet />
    <ToastContainer />
  </AppProviders>
);

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        path: '/login',
        element: (
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        )
      },
      {
        path: '/',
        element: <ProtectedRoute />,
        children: [
          {
            element: <MainLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'records', element: <RecordsPage /> },
              { path: 'members', element: <MembersPage /> },
              { path: 'members/:memberKey/records', element: <MemberRecordsPage /> },
              { path: 'weekly-history', element: <WeeklyHistoryPage /> },
              { path: 'profile', element: <ProfilePage /> },
              {
                path: 'admin',
                element: <AdminRoute />,
                children: [
                  { index: true, element: <Navigate to="members" replace /> },
                  { path: 'members', element: <AdminMembersPage /> },
                  { path: 'network-policy', element: <AdminNetworkPolicyPage /> },
                  { path: 'records-export', element: <AdminRecordsExportPage /> }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
