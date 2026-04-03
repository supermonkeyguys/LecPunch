import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@lecpunch/shared';
import * as ipaddr from 'ipaddr.js';
import type { Request } from 'express';

@Injectable()
export class NetworkPolicyService {
  private readonly allowAny: boolean;
  private readonly allowedIps: Set<string>;
  private readonly allowedCidrs: Array<[ipaddr.IPv4 | ipaddr.IPv6, number]>;
  private readonly trustProxy: boolean;
  private readonly trustedProxyHops: number;

  constructor(private readonly configService: ConfigService) {
    this.allowAny = configService.get<boolean>('ALLOW_ANY_NETWORK', true);
    this.allowedIps = new Set(this.parseCsv(configService.get<string>('ALLOWED_PUBLIC_IPS')));
    this.allowedCidrs = this.parseCsv(configService.get<string>('ALLOWED_CIDRS')).flatMap((cidr) => {
      try {
        return [ipaddr.parseCIDR(cidr)];
      } catch {
        return [];
      }
    });
    this.trustProxy = configService.get<boolean>('TRUST_PROXY', false);
    this.trustedProxyHops = configService.get<number>('TRUSTED_PROXY_HOPS', 1);
  }

  getClientIp(request: Request): string {
    if (this.trustProxy) {
      const forwarded = request.headers['x-forwarded-for'];
      if (typeof forwarded === 'string' && forwarded.length > 0) {
        const parts = forwarded.split(',').map((part) => part.trim());
        const index = Math.max(0, parts.length - this.trustedProxyHops - 1);
        return this.normalizeIp(parts[index] ?? parts[0]);
      }
    }

    return this.normalizeIp(request.ip || request.socket.remoteAddress || '');
  }

  assertIpAllowed(ip: string) {
    if (!this.isIpAllowed(ip)) {
      throw new ForbiddenException({
        code: ERROR_CODES.ATTENDANCE_NETWORK_NOT_ALLOWED,
        message: '当前网络不允许打卡'
      });
    }
  }

  isIpAllowed(ip: string) {
    if (this.allowAny) return true;
    if (!ip) return false;
    if (this.allowedIps.has(ip)) {
      return true;
    }

    try {
      const parsedIp = ipaddr.parse(ip);
      return this.allowedCidrs.some(([range, prefix]) => parsedIp.match(range, prefix));
    } catch {
      return false;
    }
  }

  private parseCsv(value?: string | null) {
    if (!value) return [] as string[];
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => this.normalizeIp(item));
  }

  private normalizeIp(ip: string) {
    if (!ip) return '';
    return ip.startsWith('::ffff:') ? ip.replace('::ffff:', '') : ip;
  }
}
