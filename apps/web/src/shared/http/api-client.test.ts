import { describe, expect, it, beforeEach, vi } from 'vitest';

const state = {
  auth: {
    setAuth: vi.fn()
  }
};

vi.mock('@/app/store/root-store', () => ({
  useRootStore: {
    getState: () => ({
      setAuth: state.auth.setAuth
    })
  }
}));

describe('apiClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('uses VITE_API_BASE_URL when provided', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:4000');

    const { apiClient } = await import('./api-client');

    expect(apiClient.defaults.baseURL).toBe('http://localhost:4000');
  });

  it('falls back to /api when VITE_API_BASE_URL is not provided', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    const { apiClient } = await import('./api-client');

    expect(apiClient.defaults.baseURL).toBe('/api');
  });
});
