import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@lecpunch/shared';
import { describe, expect, it } from 'vitest';
import { NetworkPolicyService } from './network-policy.service';

const createService = (config: Record<string, unknown>) =>
  new NetworkPolicyService(new ConfigService(config));

describe('NetworkPolicyService', () => {
  it('allows all networks when enforcement is disabled', () => {
    const service = createService({
      ALLOW_ANY_NETWORK: true
    });

    expect(service.isIpAllowed('203.0.113.10')).toBe(true);
    expect(service.isIpAllowed('')).toBe(true);
  });

  it('matches exact IPs and CIDRs after normalizing request addresses', () => {
    const service = createService({
      ALLOW_ANY_NETWORK: false,
      ALLOWED_PUBLIC_IPS: '203.0.113.10',
      ALLOWED_CIDRS: '192.168.0.0/16'
    });

    expect(service.isIpAllowed('::ffff:203.0.113.10')).toBe(true);
    expect(service.isIpAllowed('192.168.10.20')).toBe(true);
    expect(service.isIpAllowed('198.51.100.99')).toBe(false);
  });

  it('throws a stable forbidden error code for disallowed networks', () => {
    const service = createService({
      ALLOW_ANY_NETWORK: false,
      ALLOWED_PUBLIC_IPS: '203.0.113.10'
    });

    expect(() => service.assertIpAllowed('198.51.100.99')).toThrowError(ForbiddenException);

    try {
      service.assertIpAllowed('198.51.100.99');
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: ERROR_CODES.ATTENDANCE_NETWORK_NOT_ALLOWED
        }
      });
    }
  });

  it('resolves the client ip from x-forwarded-for using trusted proxy hops', () => {
    const service = createService({
      ALLOW_ANY_NETWORK: false,
      TRUST_PROXY: true,
      TRUSTED_PROXY_HOPS: 2
    });

    const clientIp = service.getClientIp({
      headers: {
        'x-forwarded-for': '198.51.100.10, 10.0.0.2, 10.0.0.3'
      },
      ip: '::ffff:127.0.0.1',
      socket: {
        remoteAddress: '::ffff:127.0.0.1'
      }
    } as any);

    expect(clientIp).toBe('198.51.100.10');
  });

  it('falls back to the direct socket ip when proxy trust is disabled', () => {
    const service = createService({
      ALLOW_ANY_NETWORK: false,
      TRUST_PROXY: false
    });

    const clientIp = service.getClientIp({
      headers: {
        'x-forwarded-for': '198.51.100.10, 10.0.0.2'
      },
      ip: '::ffff:203.0.113.10',
      socket: {
        remoteAddress: '::ffff:203.0.113.11'
      }
    } as any);

    expect(clientIp).toBe('203.0.113.10');
  });

  it('normalizes forwarded IPs that include ports', () => {
    const service = createService({
      ALLOW_ANY_NETWORK: false,
      TRUST_PROXY: true,
      TRUSTED_PROXY_HOPS: 1
    });

    const clientIp = service.getClientIp({
      headers: {
        'x-forwarded-for': '203.0.113.10:54000, 10.0.0.2'
      },
      ip: '::ffff:127.0.0.1',
      socket: {
        remoteAddress: '::ffff:127.0.0.1'
      }
    } as any);

    expect(clientIp).toBe('203.0.113.10');
  });
});
