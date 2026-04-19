import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/app/store/auth-store';
import { AppHeader } from './AppHeader';

const mocks = vi.hoisted(() => ({
  getCurrentNetworkStatus: vi.fn()
}));

vi.mock('@/features/network-policy/network-policy.api', () => ({
  getCurrentNetworkStatus: mocks.getCurrentNetworkStatus
}));

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      auth: {
        token: 'token',
        user: {
          id: 'member-1',
          teamId: 'team-1',
          username: 'member',
          displayName: 'Member',
          role: 'member',
          status: 'active',
          enrollYear: 2024,
          createdAt: '2026-04-11T00:00:00.000Z',
          updatedAt: '2026-04-11T00:00:00.000Z'
        }
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a blocked network state when the current request is not allowed', async () => {
    mocks.getCurrentNetworkStatus.mockResolvedValue({
      clientIp: '203.0.113.10',
      isAllowed: false
    });

    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    );

    expect(await screen.findByText('当前网络未放行')).toBeInTheDocument();
    expect(screen.getByTitle('服务端识别 IP: 203.0.113.10')).toBeInTheDocument();
  });

  it('shows a connected network state when the current request is allowed', async () => {
    mocks.getCurrentNetworkStatus.mockResolvedValue({
      clientIp: '198.51.100.8',
      isAllowed: true
    });

    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    );

    expect(await screen.findByText('已连接团队网络')).toBeInTheDocument();
  });
});
