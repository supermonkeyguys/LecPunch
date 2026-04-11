import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useRootStore } from '@/app/store/root-store';
import { AdminNetworkPolicyPage } from './AdminNetworkPolicyPage';

const mocks = vi.hoisted(() => ({
  getAdminNetworkPolicy: vi.fn(),
  updateAdminNetworkPolicy: vi.fn()
}));

vi.mock('@/features/network-policy/network-policy.api', () => ({
  getAdminNetworkPolicy: mocks.getAdminNetworkPolicy,
  updateAdminNetworkPolicy: mocks.updateAdminNetworkPolicy
}));

describe('AdminNetworkPolicyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRootStore.setState({
      auth: {
        token: 'token',
        user: {
          id: 'admin-1',
          teamId: 'team-1',
          username: 'admin',
          displayName: 'Admin',
          role: 'admin',
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

  it('loads the current policy into the admin form', async () => {
    mocks.getAdminNetworkPolicy.mockResolvedValue({
      teamId: 'team-1',
      source: 'environment',
      allowAnyNetwork: false,
      allowedPublicIps: ['203.0.113.10'],
      allowedCidrs: ['192.168.0.0/16'],
      trustProxy: false,
      trustedProxyHops: 1,
      updatedAt: null
    });

    render(
      <MemoryRouter>
        <AdminNetworkPolicyPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('环境变量兜底')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '允许任意网络' })).not.toBeChecked();
    expect(screen.getByLabelText('允许的公网 IP')).toHaveValue('203.0.113.10');
    expect(screen.getByLabelText('允许的 CIDR 网段')).toHaveValue('192.168.0.0/16');
  });

  it('submits normalized lists back to the API', async () => {
    mocks.getAdminNetworkPolicy.mockResolvedValue({
      teamId: 'team-1',
      source: 'environment',
      allowAnyNetwork: false,
      allowedPublicIps: ['203.0.113.10'],
      allowedCidrs: [],
      trustProxy: false,
      trustedProxyHops: 1,
      updatedAt: null
    });
    mocks.updateAdminNetworkPolicy.mockResolvedValue({
      teamId: 'team-1',
      source: 'database',
      allowAnyNetwork: false,
      allowedPublicIps: ['203.0.113.10', '198.51.100.8'],
      allowedCidrs: ['192.168.0.0/16', '10.0.0.0/8'],
      trustProxy: true,
      trustedProxyHops: 2,
      updatedAt: '2026-04-11T08:30:00.000Z'
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminNetworkPolicyPage />
      </MemoryRouter>
    );

    const allowedIps = await screen.findByLabelText('允许的公网 IP');
    const allowedCidrs = screen.getByLabelText('允许的 CIDR 网段');
    const proxyHops = screen.getByLabelText('受信任代理层数');

    await user.clear(allowedIps);
    await user.type(allowedIps, '203.0.113.10{enter}198.51.100.8');
    await user.clear(allowedCidrs);
    await user.type(allowedCidrs, '192.168.0.0/16, 10.0.0.0/8');
    await user.click(screen.getByRole('checkbox', { name: '信任反向代理' }));
    fireEvent.change(proxyHops, { target: { value: '2' } });
    await user.click(screen.getByRole('button', { name: '保存网络策略' }));

    await waitFor(() => {
      expect(mocks.updateAdminNetworkPolicy).toHaveBeenCalledWith({
        allowAnyNetwork: false,
        allowedPublicIps: ['203.0.113.10', '198.51.100.8'],
        allowedCidrs: ['192.168.0.0/16', '10.0.0.0/8'],
        trustProxy: true,
        trustedProxyHops: 2
      });
    });
    expect(screen.getByText('数据库策略')).toBeInTheDocument();
  });
});
