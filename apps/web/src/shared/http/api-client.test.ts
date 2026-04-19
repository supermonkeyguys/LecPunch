import { AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  auth: {
    token: null as string | null
  },
  setAuth: vi.fn()
};

vi.mock('@/app/store/auth-store', () => ({
  useAuthStore: {
    getState: () => ({
      auth: {
        token: state.auth.token
      },
      setAuth: state.setAuth
    })
  }
}));

const getRequestHandler = (apiClient: { interceptors: { request: unknown } }) =>
  (apiClient.interceptors.request as {
    handlers: Array<{ fulfilled?: (config: { headers?: unknown }) => { headers?: unknown } }>;
  }).handlers[0]?.fulfilled;

const getResponseErrorHandler = (apiClient: { interceptors: { response: unknown } }) =>
  (apiClient.interceptors.response as {
    handlers: Array<{ rejected?: (error: unknown) => Promise<unknown> }>;
  }).handlers[0]?.rejected;

describe('apiClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.auth.token = null;
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

  it('injects bearer token into request headers', async () => {
    state.auth.token = 'token-123';
    const { apiClient } = await import('./api-client');
    const handler = getRequestHandler(apiClient);

    const config = handler?.({ headers: {} });
    const headers = AxiosHeaders.from((config?.headers ?? {}) as Record<string, string>);

    expect(headers.get('Authorization')).toBe('Bearer token-123');
  });

  it('clears auth and navigates to login when response is 401', async () => {
    const { apiClient, setNavigateToLogin } = await import('./api-client');
    const navigateToLogin = vi.fn();
    setNavigateToLogin(navigateToLogin);
    const handler = getResponseErrorHandler(apiClient);
    const error = { response: { status: 401 } };

    await expect(handler?.(error)).rejects.toEqual(error);
    expect(state.setAuth).toHaveBeenCalledWith({ token: null, user: null });
    expect(navigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('does not clear auth for non-401 errors', async () => {
    const { apiClient, setNavigateToLogin } = await import('./api-client');
    const navigateToLogin = vi.fn();
    setNavigateToLogin(navigateToLogin);
    const handler = getResponseErrorHandler(apiClient);
    const error = { response: { status: 500 } };

    await expect(handler?.(error)).rejects.toEqual(error);
    expect(state.setAuth).not.toHaveBeenCalled();
    expect(navigateToLogin).not.toHaveBeenCalled();
  });
});
