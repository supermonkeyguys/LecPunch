import { describe, expect, it } from 'vitest';
import { getApiErrorCode, getApiErrorMessage } from './api-error';

describe('api-error helpers', () => {
  it('maps known business error code to localized message', () => {
    const error = {
      response: {
        status: 400,
        data: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'raw'
        }
      }
    };

    expect(getApiErrorCode(error)).toBe('AUTH_INVALID_CREDENTIALS');
    expect(getApiErrorMessage(error)).toBe('用户名或密码错误');
  });

  it('returns service-unavailable message for 502/503/504 responses', () => {
    const gatewayError = { response: { status: 502, data: { message: 'Bad Gateway' } } };
    const unavailableError = { response: { status: 503, data: { message: 'Unavailable' } } };
    const timeoutError = { response: { status: 504, data: { message: 'Gateway Timeout' } } };

    expect(getApiErrorMessage(gatewayError)).toContain('后端服务不可达');
    expect(getApiErrorMessage(unavailableError)).toContain('后端服务不可达');
    expect(getApiErrorMessage(timeoutError)).toContain('后端服务不可达');
  });

  it('returns service-unavailable message for network connection errors', () => {
    const networkError = { code: 'ERR_NETWORK', message: 'Network Error' };
    const refusedError = { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:4000' };

    expect(getApiErrorMessage(networkError)).toContain('后端服务不可达');
    expect(getApiErrorMessage(refusedError)).toContain('后端服务不可达');
  });

  it('falls back to provided fallback message for unknown errors', () => {
    expect(getApiErrorMessage({ foo: 'bar' } as unknown, '自定义失败')).toBe('自定义失败');
  });
});
