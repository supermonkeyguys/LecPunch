import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '@/pages/login/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { RecordsPage } from '@/pages/records/RecordsPage';
import { MembersPage } from '@/pages/members/MembersPage';
import { MemberRecordsPage } from '@/pages/member-records/MemberRecordsPage';
import { WeeklyHistoryPage } from '@/pages/weekly-history/WeeklyHistoryPage';

const router = createBrowserRouter([
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
          {
            path: 'members/:userId/records',
            element: <MemberRecordsPage />
          },
          { path: 'weekly-history', element: <WeeklyHistoryPage /> }
        ]
      }
    ]
  }
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
