import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@lecpunch/shared';
import type { Request } from 'express';
import * as ipaddr from 'ipaddr.js';

@Injectable()
export class NetworkPolicyService {
  private readonly allowAny: boolean;
  private readonly allowedIps: Set<string>;
  private readonly allowedCidrs: Array<[ipaddr.IPv4 | ipaddr.IPv6, number]>;
  private readonly trustProxy: boolean;
  private readonly trustedProxyHops: number;

  constructor(private readonly configService: ConfigService) {
    this.allowAny = configService.get<boolean>('ALLOW_ANY_NETWORK', true);
    this.allowedIps = new Set(
      this.parseCsv(configService.get<string>('ALLOWED_PUBLIC_IPS')).map((item) =>
        this.normalizeIp(item)
      )
    );
    this.allowedCidrs = this.parseCsv(configService.get<string>('ALLOWED_CIDRS')).map((cidr) => {
      try {
        return ipaddr.parseCIDR(cidr);
      } catch {
        throw new Error(`Invalid ALLOWED_CIDRS entry: ${cidr}`);
      }
    });
    this.trustProxy = configService.get<boolean>('TRUST_PROXY', false);
    this.trustedProxyHops = configService.get<number>('TRUSTED_PROXY_HOPS', 1);
  }

  getClientIp(request: Request): string {
    if (this.trustProxy) {
      const headerValue = request.headers['x-forwarded-for'];
      const forwarded = Array.isArray(headerValue) ? headerValue.join(',') : headerValue;

      if (typeof forwarded === 'string' && forwarded.length > 0) {
        return this.normalizeIp(this.pickForwardedIp(forwarded));
      }
    }

    return this.normalizeIp(request.ip || request.socket.remoteAddress || '');
  }

  assertIpAllowed(ip: string) {
    if (!this.isIpAllowed(ip)) {
      throw new ForbiddenException({
        code: ERROR_CODES.ATTENDANCE_NETWORK_NOT_ALLOWED,
        message: 'Current network is not allowed for attendance'
      });
    }
  }

  isIpAllowed(ip: string) {
    const normalizedIp = this.normalizeIp(ip);

    if (this.allowAny) {
      return true;
    }

    if (!normalizedIp) {
      return false;
    }

    if (this.allowedIps.has(normalizedIp)) {
      return true;
    }

    try {
      const parsedIp = ipaddr.parse(normalizedIp);
      return this.allowedCidrs.some(([range, prefix]) => parsedIp.match(range, prefix));
    } catch {
      return false;
    }
  }

  private parseCsv(value?: string | null) {
    if (!value) {
      return [] as string[];
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private pickForwardedIp(forwarded: string) {
    const parts = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return '';
    }

    const index = Math.max(0, parts.length - this.trustedProxyHops - 1);
    return parts[index] ?? parts[0];
  }

  private normalizeIp(ip: string) {
    if (!ip) {
      return '';
    }

    let normalized = ip.trim();
    const bracketedMatch = normalized.match(/^\[([^\]]+)\](?::\d+)?$/);

    if (bracketedMatch) {
      normalized = bracketedMatch[1];
    } else if (/^[^:]+:\d+$/.test(normalized)) {
      normalized = normalized.slice(0, normalized.lastIndexOf(':'));
    }

    if (normalized.startsWith('::ffff:')) {
      normalized = normalized.replace('::ffff:', '');
    }

    try {
      return ipaddr.parse(normalized).toString();
    } catch {
      return normalized;
    }
  }
}
