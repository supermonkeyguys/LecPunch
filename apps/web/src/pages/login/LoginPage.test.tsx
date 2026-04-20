import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { useAuthStore } from '@/app/store/auth-store';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  navigate: vi.fn()
}));

vi.mock('@/features/auth/auth.api', () => ({
  login: mocks.login
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      auth: {
        token: null,
        user: null
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders login form fields and submit action', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /欢迎回来/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/密码/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /注册/i })).toBeInTheDocument();

    const loginButtons = screen.getAllByRole('button', { name: '登录' });
    expect(loginButtons).toHaveLength(1);
    expect(loginButtons[0]).toHaveAttribute('type', 'button');

    expect(screen.getByRole('button', { name: /登录系统/i })).toBeInTheDocument();
  });

  it('submits login credentials and redirects on success', async () => {
    mocks.login.mockResolvedValue({
      accessToken: 'token-1',
      user: {
        id: 'user-1',
        teamId: 'team-1',
        username: 'alice',
        displayName: 'Alice',
        role: 'member',
        status: 'active',
        enrollYear: 2024,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z'
      }
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('用户名'), 'alice');
    await user.type(screen.getByLabelText('密码'), '123456');
    await user.click(screen.getByRole('button', { name: '登录系统' }));

    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledWith({ username: 'alice', password: '123456' });
      expect(mocks.navigate).toHaveBeenCalledWith('/');
    });

    expect(useAuthStore.getState().auth.token).toBe('token-1');
    expect(useAuthStore.getState().auth.user?.username).toBe('alice');
  });

  it('shows zod validation messages for invalid input', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('用户名'), 'alice');
    await user.type(screen.getByLabelText('密码'), '123');
    await user.click(screen.getByRole('button', { name: '登录系统' }));

    const passwordError = await screen.findByText('密码至少 6 位');
    expect(passwordError).toBeInTheDocument();
    expect(passwordError).toHaveAttribute('id', 'password-error');
    expect(screen.getByLabelText('密码')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('密码')).toHaveAttribute('aria-describedby', expect.stringContaining('password-error'));
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('surfaces API login errors to users', async () => {
    mocks.login.mockRejectedValue({
      response: {
        data: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: '用户名或密码错误'
        }
      }
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('用户名'), 'alice');
    await user.type(screen.getByLabelText('密码'), '123456');
    await user.click(screen.getByRole('button', { name: '登录系统' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('用户名或密码错误');
  });

  it('surfaces registration eligibility errors to users in register mode', async () => {
    mocks.login.mockRejectedValue({
      response: {
        data: {
          code: 'AUTH_REGISTRATION_NOT_ELIGIBLE',
          message: 'Not eligible'
        }
      }
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: '注册' }));
    await user.type(screen.getByLabelText('显示名称'), 'Alice');
    await user.type(screen.getByLabelText('真实姓名'), '张三');
    await user.type(screen.getByLabelText('学号（12位数字）'), '202612340001');
    await user.type(screen.getByLabelText('用户名'), 'alice');
    await user.type(screen.getByLabelText('密码'), '123456');
    await user.click(screen.getByRole('button', { name: '注册并登录' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('当前学号不在准入名单，请联系管理员');
  });

  it('shows registration-closed message for register mode unauthorized errors', async () => {
    mocks.login.mockRejectedValue({
      response: {
        data: {
          code: 'AUTH_UNAUTHORIZED',
          message: 'Registration is disabled'
        }
      }
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: '注册' }));
    await user.type(screen.getByLabelText('显示名称'), 'Alice');
    await user.type(screen.getByLabelText('真实姓名'), '张三');
    await user.type(screen.getByLabelText('学号（12位数字）'), '202612340001');
    await user.type(screen.getByLabelText('用户名'), 'alice');
    await user.type(screen.getByLabelText('密码'), '123456');
    await user.click(screen.getByRole('button', { name: '注册并登录' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('当前未开放注册，请联系管理员');
  });
});
