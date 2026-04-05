import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { AppProviders } from '../providers/AppProviders';
import { ToastContainer } from '@/shared/ui/toast';
import { AuthLayout } from '../layouts/AuthLayout';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '@/pages/login/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { RecordsPage } from '@/pages/records/RecordsPage';
import { MembersPage } from '@/pages/members/MembersPage';
import { MemberRecordsPage } from '@/pages/member-records/MemberRecordsPage';
import { WeeklyHistoryPage } from '@/pages/weekly-history/WeeklyHistoryPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';

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
        element: <ProtectedRoute />,
        children: [
          {
            path: '/',
            element: <MainLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'records', element: <RecordsPage /> },
              { path: 'members', element: <MembersPage /> },
              { path: 'members/:userId/records', element: <MemberRecordsPage /> },
              { path: 'weekly-history', element: <WeeklyHistoryPage /> },
              { path: 'profile', element: <ProfilePage /> }
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
