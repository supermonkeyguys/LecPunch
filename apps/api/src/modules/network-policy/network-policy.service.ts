import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@lecpunch/shared';
import type { Request } from 'express';
import * as ipaddr from 'ipaddr.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { UpdateNetworkPolicyDto } from './dto/update-network-policy.dto';
import { NetworkPolicy } from './schemas/network-policy.schema';

type PolicySource = 'database' | 'environment';

type PersistedNetworkPolicyInput = {
  allowAnyNetwork: boolean;
  allowedPublicIps: string[];
  allowedCidrs: string[];
  trustProxy: boolean;
  trustedProxyHops: number;
};

export interface NetworkPolicySnapshot extends PersistedNetworkPolicyInput {
  teamId: string;
  source: PolicySource;
  updatedAt?: Date;
}

type PersistedNetworkPolicyRecord = PersistedNetworkPolicyInput & {
  teamId: string;
  updatedAt?: Date;
};

@Injectable()
export class NetworkPolicyService {
  private readonly fallbackPolicy: PersistedNetworkPolicyInput;

  constructor(
    configService: ConfigService,
    @InjectModel(NetworkPolicy.name)
    private readonly networkPolicyModel: Model<NetworkPolicy>
  ) {
    this.fallbackPolicy = this.normalizePolicy({
      allowAnyNetwork: configService.get<boolean>('ALLOW_ANY_NETWORK', true),
      allowedPublicIps: this.parseCsv(configService.get<string>('ALLOWED_PUBLIC_IPS')),
      allowedCidrs: this.parseCsv(configService.get<string>('ALLOWED_CIDRS')),
      trustProxy: configService.get<boolean>('TRUST_PROXY', false),
      trustedProxyHops: configService.get<number>('TRUSTED_PROXY_HOPS', 1)
    });
  }

  async getAdminPolicy(teamId: string) {
    return this.resolvePolicy(teamId);
  }

  async updateAdminPolicy(teamId: string, input: UpdateNetworkPolicyDto) {
    const nextPolicy = this.normalizePolicy(input);
    this.assertAllowlistConfigured(nextPolicy);

    const updated = await this.networkPolicyModel
      .findOneAndUpdate(
        { teamId },
        { $set: nextPolicy },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      .exec();

    if (!updated) {
      throw new BadRequestException('Failed to persist network policy');
    }

    return this.toSnapshot({
      teamId: updated.teamId,
      allowAnyNetwork: updated.allowAnyNetwork,
      allowedPublicIps: updated.allowedPublicIps,
      allowedCidrs: updated.allowedCidrs,
      trustProxy: updated.trustProxy,
      trustedProxyHops: updated.trustedProxyHops,
      updatedAt: updated.updatedAt as Date | undefined
    }, 'database');
  }

  async getClientIp(teamId: string, request: Request): Promise<string> {
    const policy = await this.resolvePolicy(teamId);

    if (policy.trustProxy) {
      const headerValue = request.headers['x-forwarded-for'];
      const forwarded = Array.isArray(headerValue) ? headerValue.join(',') : headerValue;

      if (typeof forwarded === 'string' && forwarded.length > 0) {
        return this.normalizeIp(this.pickForwardedIp(forwarded, policy.trustedProxyHops));
      }
    }

    return this.normalizeIp(request.ip || request.socket.remoteAddress || '');
  }

  async assertIpAllowed(teamId: string, ip: string) {
    if (!(await this.isIpAllowed(teamId, ip))) {
      throw new ForbiddenException({
        code: ERROR_CODES.ATTENDANCE_NETWORK_NOT_ALLOWED,
        message: 'Current network is not allowed for attendance'
      });
    }
  }

  async isIpAllowed(teamId: string, ip: string) {
    const policy = await this.resolvePolicy(teamId);
    const normalizedIp = this.normalizeIp(ip);

    if (policy.allowAnyNetwork) {
      return true;
    }

    if (!normalizedIp) {
      return false;
    }

    if (policy.allowedPublicIps.includes(normalizedIp)) {
      return true;
    }

    try {
      const parsedIp = ipaddr.parse(normalizedIp);
      return policy.allowedCidrs.some((cidr) => {
        const [range, prefix] = ipaddr.parseCIDR(cidr);
        return parsedIp.match(range, prefix);
      });
    } catch {
      return false;
    }
  }

  private async resolvePolicy(teamId: string): Promise<NetworkPolicySnapshot> {
    const stored = await this.networkPolicyModel.findOne({ teamId }).exec();
    if (!stored) {
      return {
        teamId,
        source: 'environment',
        ...this.fallbackPolicy
      };
    }

    return this.toSnapshot({
      teamId: stored.teamId,
      allowAnyNetwork: stored.allowAnyNetwork,
      allowedPublicIps: stored.allowedPublicIps,
      allowedCidrs: stored.allowedCidrs,
      trustProxy: stored.trustProxy,
      trustedProxyHops: stored.trustedProxyHops,
      updatedAt: stored.updatedAt as Date | undefined
    }, 'database');
  }

  private toSnapshot(policy: PersistedNetworkPolicyRecord, source: PolicySource): NetworkPolicySnapshot {
    const normalized = this.normalizePolicy({
      allowAnyNetwork: policy.allowAnyNetwork,
      allowedPublicIps: policy.allowedPublicIps,
      allowedCidrs: policy.allowedCidrs,
      trustProxy: policy.trustProxy,
      trustedProxyHops: policy.trustedProxyHops
    });

    return {
      teamId: policy.teamId,
      source,
      updatedAt: policy.updatedAt,
      ...normalized
    };
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

  private normalizePolicy(input: PersistedNetworkPolicyInput): PersistedNetworkPolicyInput {
    const trustedProxyHops =
      Number.isFinite(input.trustedProxyHops) && input.trustedProxyHops > 0
        ? Math.floor(input.trustedProxyHops)
        : 1;

    return {
      allowAnyNetwork: Boolean(input.allowAnyNetwork),
      allowedPublicIps: Array.from(
        new Set((input.allowedPublicIps ?? []).map((item) => this.normalizeConfiguredIp(item)).filter(Boolean))
      ),
      allowedCidrs: Array.from(
        new Set((input.allowedCidrs ?? []).map((item) => this.normalizeConfiguredCidr(item)).filter(Boolean))
      ),
      trustProxy: Boolean(input.trustProxy),
      trustedProxyHops
    };
  }

  private assertAllowlistConfigured(policy: PersistedNetworkPolicyInput) {
    if (!policy.allowAnyNetwork && policy.allowedPublicIps.length === 0 && policy.allowedCidrs.length === 0) {
      throw new BadRequestException('At least one allowed IP or CIDR is required when network enforcement is enabled');
    }
  }

  private pickForwardedIp(forwarded: string, trustedProxyHops: number) {
    const parts = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return '';
    }

    const index = Math.max(0, parts.length - trustedProxyHops - 1);
    return parts[index] ?? parts[0];
  }

  private normalizeConfiguredIp(ip: string) {
    const normalized = this.normalizeIp(ip);
    if (!normalized) {
      return '';
    }

    try {
      return ipaddr.parse(normalized).toString();
    } catch {
      throw new BadRequestException(`Invalid allowed IP address: ${ip}`);
    }
  }

  private normalizeConfiguredCidr(cidr: string) {
    const normalized = cidr.trim();
    if (!normalized) {
      return '';
    }

    try {
      const [range, prefix] = ipaddr.parseCIDR(normalized);
      return `${range.toString()}/${prefix}`;
    } catch {
      throw new BadRequestException(`Invalid allowed CIDR: ${cidr}`);
    }
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
