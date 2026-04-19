import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { useAuthStore } from '@/app/store/auth-store';
import { AdminRoute } from './AdminRoute';

describe('AdminRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      auth: {
        token: 'token',
        user: {
          id: 'user-1',
          teamId: 'team-1',
          username: 'demo',
          displayName: 'Demo',
          role: 'member',
          status: 'active',
          enrollYear: 2024,
          createdAt: '2026-04-11T00:00:00.000Z',
          updatedAt: '2026-04-11T00:00:00.000Z'
        }
      }
    });
  });

  it('redirects non-admin users away from admin routes', () => {
    render(
      <MemoryRouter initialEntries={['/admin/members']}>
        <Routes>
          <Route path="/" element={<div>Dashboard</div>} />
          <Route element={<AdminRoute />}>
            <Route path="/admin/members" element={<div>Admin Members</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin Members')).not.toBeInTheDocument();
  });

  it('allows admin users to enter admin routes', () => {
    useAuthStore.setState((state) => ({
      auth: {
        ...state.auth,
        user: state.auth.user ? { ...state.auth.user, role: 'admin' } : null
      }
    }));

    render(
      <MemoryRouter initialEntries={['/admin/members']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin/members" element={<div>Admin Members</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Members')).toBeInTheDocument();
  });
});
