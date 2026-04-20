import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/app/store/auth-store';
import { AdminMemberEligibilityPage } from './AdminMemberEligibilityPage';

const mocks = vi.hoisted(() => ({
  getAdminMemberEligibilityEntries: vi.fn(),
  createAdminMemberEligibilityEntry: vi.fn(),
  updateAdminMemberEligibilityEntry: vi.fn(),
  deleteAdminMemberEligibilityEntry: vi.fn()
}));

vi.mock('@/features/member-eligibility/member-eligibility.api', () => ({
  getAdminMemberEligibilityEntries: mocks.getAdminMemberEligibilityEntries,
  createAdminMemberEligibilityEntry: mocks.createAdminMemberEligibilityEntry,
  updateAdminMemberEligibilityEntry: mocks.updateAdminMemberEligibilityEntry,
  deleteAdminMemberEligibilityEntry: mocks.deleteAdminMemberEligibilityEntry
}));

describe('AdminMemberEligibilityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
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

  it('loads and filters entries from admin API', async () => {
    mocks.getAdminMemberEligibilityEntries.mockResolvedValue([
      {
        id: 'entry-1',
        teamId: 'team-1',
        studentId: '202400000001',
        realName: 'Alice',
        status: 'allowed',
        note: 'seed',
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z'
      },
      {
        id: 'entry-2',
        teamId: 'team-1',
        studentId: '202400000002',
        realName: 'Bob',
        status: 'blocked',
        note: '',
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z'
      }
    ]);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminMemberEligibilityPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('状态筛选'), 'blocked');
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('creates a new entry from the admin form', async () => {
    mocks.getAdminMemberEligibilityEntries.mockResolvedValue([]);
    mocks.createAdminMemberEligibilityEntry.mockResolvedValue({
      id: 'entry-9',
      teamId: 'team-1',
      studentId: '202400000009',
      realName: 'Carol',
      status: 'allowed',
      note: 'new',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z'
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminMemberEligibilityPage />
      </MemoryRouter>
    );

    await user.type(await screen.findByLabelText('学号'), '202400000009');
    await user.type(screen.getByLabelText('真实姓名'), 'Carol');
    await user.type(screen.getByLabelText('备注（可选）'), 'new');
    await user.click(screen.getByRole('button', { name: '新增条目' }));

    await waitFor(() => {
      expect(mocks.createAdminMemberEligibilityEntry).toHaveBeenCalledWith({
        studentId: '202400000009',
        realName: 'Carol',
        status: 'allowed',
        note: 'new'
      });
    });
    expect(screen.getByText('Carol')).toBeInTheDocument();
  });
});
