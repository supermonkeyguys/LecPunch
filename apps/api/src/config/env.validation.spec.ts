import { describe, expect, it } from 'vitest';
import { validationSchema } from './env.validation';

const baseEnv = {
  MONGODB_URI: 'mongodb://localhost:27017/lecpunch',
  AUTH_SECRET: '1234567890abcdef'
};

describe('validationSchema', () => {
  it('rejects invalid exact IP entries', () => {
    const { error } = validationSchema.validate({
      ...baseEnv,
      ALLOW_ANY_NETWORK: 'false',
      ALLOWED_PUBLIC_IPS: '127.0.0.1,not-an-ip',
      ALLOWED_CIDRS: '192.168.0.0/16'
    });

    expect(error?.message).toContain('ALLOWED_PUBLIC_IPS contains an invalid IP address');
  });

  it('rejects invalid CIDR entries', () => {
    const { error } = validationSchema.validate({
      ...baseEnv,
      ALLOW_ANY_NETWORK: 'false',
      ALLOWED_PUBLIC_IPS: '',
      ALLOWED_CIDRS: '10.0.0.0/8,not-a-cidr'
    });

    expect(error?.message).toContain('ALLOWED_CIDRS contains an invalid CIDR');
  });

  it('requires at least one allowlist when network enforcement is enabled', () => {
    const { error } = validationSchema.validate({
      ...baseEnv,
      ALLOW_ANY_NETWORK: 'false',
      ALLOWED_PUBLIC_IPS: '',
      ALLOWED_CIDRS: ''
    });

    expect(error?.message).toContain(
      'ALLOWED_PUBLIC_IPS or ALLOWED_CIDRS must be configured when ALLOW_ANY_NETWORK=false'
    );
  });

  it('accepts exact IPs, CIDRs, and trusted proxy settings together', () => {
    const { error, value } = validationSchema.validate({
      ...baseEnv,
      ALLOW_ANY_NETWORK: 'false',
      ALLOWED_PUBLIC_IPS: '127.0.0.1,203.0.113.10',
      ALLOWED_CIDRS: '10.0.0.0/8,192.168.0.0/16',
      TRUST_PROXY: 'true',
      TRUSTED_PROXY_HOPS: '2'
    });

    expect(error).toBeUndefined();
    expect(value.TRUST_PROXY).toBe(true);
    expect(value.TRUSTED_PROXY_HOPS).toBe(2);
  });

  it('enables balanced attendance accounting by default', () => {
    const { error, value } = validationSchema.validate({
      ...baseEnv
    });

    expect(error).toBeUndefined();
    expect(value.ATTENDANCE_BALANCED_ACCOUNTING_ENABLED).toBe(true);
  });
});
