import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('renders login form fields and submit action', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /登录/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/密码/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /注册/i })).toBeInTheDocument();

    const loginButtons = screen.getAllByRole('button', { name: '登录' });
    expect(loginButtons).toHaveLength(2);
    expect(loginButtons[0]).toHaveAttribute('type', 'button');
    expect(loginButtons[1]).toHaveAttribute('type', 'submit');
  });
});
