import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfilePage } from './ProfilePage';
import { useAuthStore } from '@/app/store/auth-store';

const mocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  updatePassword: vi.fn(),
  showToast: vi.fn()
}));

vi.mock('@/features/users/users.api', () => ({
  updateProfile: mocks.updateProfile,
  updatePassword: mocks.updatePassword
}));

vi.mock('@/shared/ui/toast', () => ({
  showToast: mocks.showToast
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      auth: {
        token: 'token-1',
        user: {
          id: 'user-1',
          teamId: 'team-1',
          username: 'alice',
          displayName: 'Alice',
          realName: 'Alice Zhang',
          studentId: '20261234',
          role: 'member',
          status: 'active',
          enrollYear: 2024,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z'
        }
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows zod validation when display name is too short', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    const displayNameInput = screen.getByLabelText('显示名称');
    await user.clear(displayNameInput);
    await user.type(displayNameInput, 'A');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByText('显示名称至少 2 个字符')).toBeInTheDocument();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it('submits trimmed display name and updates auth snapshot', async () => {
    mocks.updateProfile.mockResolvedValue({
      id: 'user-1',
      teamId: 'team-1',
      username: 'alice',
      displayName: 'Alice New',
      realName: 'Alice Zhang',
      studentId: '20261234',
      role: 'member',
      status: 'active',
      enrollYear: 2024,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:00.000Z'
    });

    const user = userEvent.setup();
    render(<ProfilePage />);

    const displayNameInput = screen.getByLabelText('显示名称');
    await user.clear(displayNameInput);
    await user.type(displayNameInput, '  Alice New  ');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(mocks.updateProfile).toHaveBeenCalledWith({ displayName: 'Alice New' });
    });
    expect(useAuthStore.getState().auth.user?.displayName).toBe('Alice New');
    expect(mocks.showToast).toHaveBeenCalledWith('资料已保存');
  });

  it('blocks password submit when confirmation mismatches', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await user.type(screen.getByLabelText('当前密码'), 'old-password');
    await user.type(screen.getByLabelText('新密码'), 'new-password');
    await user.type(screen.getByLabelText('确认新密码'), 'new-password-2');
    await user.click(screen.getByRole('button', { name: '修改密码' }));

    expect(await screen.findByText('两次输入的密码不一致')).toBeInTheDocument();
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  it('maps WRONG_PASSWORD to field error', async () => {
    mocks.updatePassword.mockRejectedValue({
      response: {
        data: {
          code: 'WRONG_PASSWORD'
        }
      }
    });

    const user = userEvent.setup();
    render(<ProfilePage />);

    await user.type(screen.getByLabelText('当前密码'), 'wrong-old-password');
    await user.type(screen.getByLabelText('新密码'), 'new-password');
    await user.type(screen.getByLabelText('确认新密码'), 'new-password');
    await user.click(screen.getByRole('button', { name: '修改密码' }));

    expect(await screen.findByText('当前密码不正确')).toBeInTheDocument();
  });
});
